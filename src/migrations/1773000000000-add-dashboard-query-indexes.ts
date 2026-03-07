import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDashboardQueryIndexes1773000000000 implements MigrationInterface {
    name = "AddDashboardQueryIndexes1773000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Already covered by 1771200000000:
        // - sales_orders (branch_id, status, create_date DESC)
        // - sales_order_item (order_id, status)
        // This migration adds only the missing indexes for the refactored dashboard queries.

        // Speeds recent orders reads filtered by branch/status and ordered by latest update.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_status_update_date_desc"
            ON "sales_orders" ("branch_id", "status", "update_date" DESC)
        `);

        // Helps top-items aggregation when grouping by product over active/non-cancelled items.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_order_item_product_status"
            ON "sales_order_item" ("product_id", "status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_order_item_product_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_status_update_date_desc"`);
    }
}
