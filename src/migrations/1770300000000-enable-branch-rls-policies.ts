import { MigrationInterface, QueryRunner } from "typeorm";

export class EnableBranchRlsPolicies1770300000000 implements MigrationInterface {
    name = "EnableBranchRlsPolicies1770300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Helper schema/functions used by policies
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS app`);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION app.current_branch_id()
            RETURNS uuid
            LANGUAGE sql
            STABLE
            AS $$
                SELECT NULLIF(current_setting('app.branch_id', true), '')::uuid;
            $$;
        `);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION app.is_admin()
            RETURNS boolean
            LANGUAGE sql
            STABLE
            AS $$
                SELECT current_setting('app.is_admin', true) = 'true';
            $$;
        `);

        // Indexes used by RLS policies / joins
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_sales_order_detail_orders_item_id" ON "sales_order_detail" ("orders_item_id")`
        );

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
                USING (app.is_admin() OR "branch_id" = app.current_branch_id())
                WITH CHECK (app.is_admin() OR "branch_id" = app.current_branch_id())
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

        for (const { table, existsSql } of childPolicies) {
            await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
            await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
            await queryRunner.query(`
                CREATE POLICY "branch_isolation" ON "${table}"
                USING (app.is_admin() OR ${existsSql})
                WITH CHECK (app.is_admin() OR ${existsSql})
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop child policies
        const childTables = ["sales_order_item", "sales_order_detail", "stock_orders_item", "stock_orders_detail"];
        for (const table of childTables) {
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
            await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
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
            await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "${table}"`);
            await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
        }

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_detail_orders_item_id"`);

        // Keep schema; only remove functions we created
        await queryRunner.query(`DROP FUNCTION IF EXISTS app.current_branch_id()`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS app.is_admin()`);
    }
}

