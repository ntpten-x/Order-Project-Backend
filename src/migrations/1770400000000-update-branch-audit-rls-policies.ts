import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateBranchAuditRlsPolicies1770400000000 implements MigrationInterface {
    name = "UpdateBranchAuditRlsPolicies1770400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure helper schema/functions used by policies exist.
        // Avoid unconditional CREATE SCHEMA because PostgreSQL checks DB-level CREATE privilege
        // even when the schema already exists.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'app') THEN
                    IF has_database_privilege(current_user, current_database(), 'CREATE') THEN
                        EXECUTE 'CREATE SCHEMA app';
                    ELSE
                        RAISE EXCEPTION
                            'schema "app" is missing and role "%" lacks CREATE on database "%"',
                            current_user,
                            current_database();
                    END IF;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION app.current_branch_id()
            RETURNS uuid
            LANGUAGE sql
            STABLE
            AS $$
                SELECT NULLIF(current_setting('app.branch_id', true), '')::uuid;
            $$;
        `);

        // Ensure boolean return is never NULL (NULL is treated as false in policies, but explicit is clearer)
        await queryRunner.query(`
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
            await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
            await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
            await queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (${branchIsolationSql})
                WITH CHECK (${branchIsolationSql})
            `);
        }

        // Child tables without branch_id: enforce via parent branch_id
        const childPolicies: Array<{ table: string; existsSql: string }> = [
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
            await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
            await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);

            const combined = childIsolationSql.replace("%EXISTS%", existsSql);
            await queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (${combined})
                WITH CHECK (${combined})
            `);
        }

        // Branch master table: users can only see their own branch; only admin can modify.
        await queryRunner.query(`ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "branches" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_select" ON "branches"`);
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_admin" ON "branches"`);

        await queryRunner.query(`
            CREATE POLICY "branches_select" ON "branches"
            FOR SELECT
            USING (app.is_admin() OR "id" = app.current_branch_id())
        `);

        await queryRunner.query(`
            CREATE POLICY "branches_admin" ON "branches"
            FOR ALL
            USING (app.is_admin())
            WITH CHECK (app.is_admin())
        `);

        // Audit logs: readable per-branch; append-only from app (no UPDATE/DELETE policies).
        await queryRunner.query(`ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_select" ON "audit_logs"`);
        await queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_insert" ON "audit_logs"`);

        await queryRunner.query(`
            CREATE POLICY "audit_logs_select" ON "audit_logs"
            FOR SELECT
            USING (("branch_id" = app.current_branch_id()) OR (app.is_admin() AND app.current_branch_id() IS NULL))
        `);

        await queryRunner.query(`
            CREATE POLICY "audit_logs_insert" ON "audit_logs"
            FOR INSERT
            WITH CHECK (("branch_id" = app.current_branch_id()) OR (app.is_admin() AND app.current_branch_id() IS NULL))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert audit_logs policies and disable RLS
        await queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_insert" ON "audit_logs"`);
        await queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_select" ON "audit_logs"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY`);

        // Revert branches policies and disable RLS
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_admin" ON "branches"`);
        await queryRunner.query(`DROP POLICY IF EXISTS "branches_select" ON "branches"`);
        await queryRunner.query(`ALTER TABLE "branches" DISABLE ROW LEVEL SECURITY`);

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
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
            await queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (${originalBranchIsolationSql})
                WITH CHECK (${originalBranchIsolationSql})
            `);
        }

        const childPolicies: Array<{ table: string; existsSql: string }> = [
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
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
            await queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (app.is_admin() OR ${existsSql})
                WITH CHECK (app.is_admin() OR ${existsSql})
            `);
        }
    }
}
