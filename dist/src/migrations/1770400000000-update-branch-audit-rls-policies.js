"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBranchAuditRlsPolicies1770400000000 = void 0;
class UpdateBranchAuditRlsPolicies1770400000000 {
    constructor() {
        this.name = "UpdateBranchAuditRlsPolicies1770400000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Ensure helper schema/functions used by policies exist
            yield queryRunner.query(`CREATE SCHEMA IF NOT EXISTS app`);
            yield queryRunner.query(`
            CREATE OR REPLACE FUNCTION app.current_branch_id()
            RETURNS uuid
            LANGUAGE sql
            STABLE
            AS $$
                SELECT NULLIF(current_setting('app.branch_id', true), '')::uuid;
            $$;
        `);
            // Ensure boolean return is never NULL (NULL is treated as false in policies, but explicit is clearer)
            yield queryRunner.query(`
            CREATE OR REPLACE FUNCTION app.is_admin()
            RETURNS boolean
            LANGUAGE sql
            STABLE
            AS $$
                SELECT COALESCE(current_setting('app.is_admin', true), 'false') = 'true';
            $$;
        `);
            // Admin bypass is allowed only when no branch context is selected.
            const branchIsolationSql = `("branch_id" = app.current_branch_id()) OR (app.is_admin() AND app.current_branch_id() IS NULL)`;
            // Branch-scoped tables with a branch_id column
            const branchTables = [
                "category",
                "products",
                "products_unit",
                "discounts",
                "delivery",
                "payment_method",
                "tables",
                "sales_orders",
                "payments",
                "shifts",
                "shop_profile",
                "shop_payment_account",
                "order_queue",
                "promotions",
                "stock_ingredients_unit",
                "stock_ingredients",
                "stock_orders",
            ];
            for (const table of branchTables) {
                yield queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
                yield queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
                yield queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
                yield queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (${branchIsolationSql})
                WITH CHECK (${branchIsolationSql})
            `);
            }
            // Child tables without branch_id: enforce via parent branch_id
            const childPolicies = [
                {
                    table: "sales_order_item",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "sales_orders" o
                        WHERE o.id = "sales_order_item"."order_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
                {
                    table: "sales_order_detail",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "sales_order_item" i
                        JOIN "sales_orders" o ON o.id = i."order_id"
                        WHERE i.id = "sales_order_detail"."orders_item_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
                {
                    table: "stock_orders_item",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "stock_orders" o
                        WHERE o.id = "stock_orders_item"."orders_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
                {
                    table: "stock_orders_detail",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "stock_orders_item" i
                        JOIN "stock_orders" o ON o.id = i."orders_id"
                        WHERE i.id = "stock_orders_detail"."orders_item_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
            ];
            const childIsolationSql = `(app.is_admin() AND app.current_branch_id() IS NULL) OR %EXISTS%`;
            for (const { table, existsSql } of childPolicies) {
                yield queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
                yield queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
                yield queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
                const combined = childIsolationSql.replace("%EXISTS%", existsSql);
                yield queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (${combined})
                WITH CHECK (${combined})
            `);
            }
            // Branch master table: users can only see their own branch; only admin can modify.
            yield queryRunner.query(`ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY`);
            yield queryRunner.query(`ALTER TABLE "branches" FORCE ROW LEVEL SECURITY`);
            yield queryRunner.query(`DROP POLICY IF EXISTS "branches_select" ON "branches"`);
            yield queryRunner.query(`DROP POLICY IF EXISTS "branches_admin" ON "branches"`);
            yield queryRunner.query(`
            CREATE POLICY "branches_select" ON "branches"
            FOR SELECT
            USING (app.is_admin() OR "id" = app.current_branch_id())
        `);
            yield queryRunner.query(`
            CREATE POLICY "branches_admin" ON "branches"
            FOR ALL
            USING (app.is_admin())
            WITH CHECK (app.is_admin())
        `);
            // Audit logs: readable per-branch; append-only from app (no UPDATE/DELETE policies).
            yield queryRunner.query(`ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY`);
            yield queryRunner.query(`ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY`);
            yield queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_select" ON "audit_logs"`);
            yield queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_insert" ON "audit_logs"`);
            yield queryRunner.query(`
            CREATE POLICY "audit_logs_select" ON "audit_logs"
            FOR SELECT
            USING (("branch_id" = app.current_branch_id()) OR (app.is_admin() AND app.current_branch_id() IS NULL))
        `);
            yield queryRunner.query(`
            CREATE POLICY "audit_logs_insert" ON "audit_logs"
            FOR INSERT
            WITH CHECK (("branch_id" = app.current_branch_id()) OR (app.is_admin() AND app.current_branch_id() IS NULL))
        `);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Revert audit_logs policies and disable RLS
            yield queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_insert" ON "audit_logs"`);
            yield queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_select" ON "audit_logs"`);
            yield queryRunner.query(`ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY`);
            // Revert branches policies and disable RLS
            yield queryRunner.query(`DROP POLICY IF EXISTS "branches_admin" ON "branches"`);
            yield queryRunner.query(`DROP POLICY IF EXISTS "branches_select" ON "branches"`);
            yield queryRunner.query(`ALTER TABLE "branches" DISABLE ROW LEVEL SECURITY`);
            // Restore original branch isolation policy (admin always bypasses)
            const originalBranchIsolationSql = `app.is_admin() OR "branch_id" = app.current_branch_id()`;
            const branchTables = [
                "category",
                "products",
                "products_unit",
                "discounts",
                "delivery",
                "payment_method",
                "tables",
                "sales_orders",
                "payments",
                "shifts",
                "shop_profile",
                "shop_payment_account",
                "order_queue",
                "promotions",
                "stock_ingredients_unit",
                "stock_ingredients",
                "stock_orders",
            ];
            for (const table of branchTables) {
                yield queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
                yield queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (${originalBranchIsolationSql})
                WITH CHECK (${originalBranchIsolationSql})
            `);
            }
            const childPolicies = [
                {
                    table: "sales_order_item",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "sales_orders" o
                        WHERE o.id = "sales_order_item"."order_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
                {
                    table: "sales_order_detail",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "sales_order_item" i
                        JOIN "sales_orders" o ON o.id = i."order_id"
                        WHERE i.id = "sales_order_detail"."orders_item_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
                {
                    table: "stock_orders_item",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "stock_orders" o
                        WHERE o.id = "stock_orders_item"."orders_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
                {
                    table: "stock_orders_detail",
                    existsSql: `
                    EXISTS (
                        SELECT 1
                        FROM "stock_orders_item" i
                        JOIN "stock_orders" o ON o.id = i."orders_id"
                        WHERE i.id = "stock_orders_detail"."orders_item_id"
                          AND o."branch_id" = app.current_branch_id()
                    )
                `,
                },
            ];
            for (const { table, existsSql } of childPolicies) {
                yield queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
                yield queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (app.is_admin() OR ${existsSql})
                WITH CHECK (app.is_admin() OR ${existsSql})
            `);
            }
        });
    }
}
exports.UpdateBranchAuditRlsPolicies1770400000000 = UpdateBranchAuditRlsPolicies1770400000000;
