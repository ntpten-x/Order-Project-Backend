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
exports.EnableBranchRlsPolicies1770300000000 = void 0;
class EnableBranchRlsPolicies1770300000000 {
    constructor() {
        this.name = "EnableBranchRlsPolicies1770300000000";
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Helper schema/functions used by policies
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
            yield queryRunner.query(`
            CREATE OR REPLACE FUNCTION app.is_admin()
            RETURNS boolean
            LANGUAGE sql
            STABLE
            AS $$
                SELECT current_setting('app.is_admin', true) = 'true';
            $$;
        `);
            // Indexes used by RLS policies / joins
            yield queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_order_detail_orders_item_id" ON "sales_order_detail" ("orders_item_id")`);
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
                USING (app.is_admin() OR "branch_id" = app.current_branch_id())
                WITH CHECK (app.is_admin() OR "branch_id" = app.current_branch_id())
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
            for (const { table, existsSql } of childPolicies) {
                yield queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
                yield queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
                yield queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
                yield queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (app.is_admin() OR ${existsSql})
                WITH CHECK (app.is_admin() OR ${existsSql})
            `);
            }
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            // Drop child policies
            const childTables = ["sales_order_item", "sales_order_detail", "stock_orders_item", "stock_orders_detail"];
            for (const table of childTables) {
                yield queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
                yield queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
            }
            // Drop branch-scoped policies
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
                yield queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
            }
            yield queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_detail_orders_item_id"`);
            // Keep schema; only remove functions we created
            yield queryRunner.query(`DROP FUNCTION IF EXISTS app.current_branch_id()`);
            yield queryRunner.query(`DROP FUNCTION IF EXISTS app.is_admin()`);
        });
    }
}
exports.EnableBranchRlsPolicies1770300000000 = EnableBranchRlsPolicies1770300000000;
