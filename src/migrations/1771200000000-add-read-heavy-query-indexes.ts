import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReadHeavyQueryIndexes1771200000000 implements MigrationInterface {
    name = "AddReadHeavyQueryIndexes1771200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Hot paths: /pos/orders/summary (branch + status/type + latest first)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_created_at_desc
            ON "sales_orders" ("branch_id", "create_date" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_status_type_created_at_desc
            ON "sales_orders" ("branch_id", "status", "order_type", "create_date" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_status_created_at_desc
            ON "sales_orders" ("branch_id", "status", "create_date" DESC)
        `);

        // Hot paths: summary lateral aggregate per order on sales_order_item
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_order_item_order_status
            ON "sales_order_item" ("order_id", "status")
        `);

        // Hot paths: dashboard sales/top-items joins on successful payments by order
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_order_status
            ON "payments" ("order_id", "status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_payments_order_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_order_item_order_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_status_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_status_type_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_created_at_desc"`);
    }
}
