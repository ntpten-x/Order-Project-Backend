import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Some environments can have a migrations table that is ahead of the actual DDL
 * (e.g. seeded/ported DB). This migration defensively ensures hot-path indexes
 * required by verify scripts exist.
 */
export class AddPosOrdersPaymentsQueuePerformanceIndexes1773600000000 implements MigrationInterface {
    name = "AddPosOrdersPaymentsQueuePerformanceIndexes1773600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Orders list / summary: branch scoped, newest first
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_created_at_desc
            ON "sales_orders" ("branch_id", "create_date" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_status_created_at_desc
            ON "sales_orders" ("branch_id", "status", "create_date" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_orders_branch_status_type_created_at_desc
            ON "sales_orders" ("branch_id", "status", "order_type", "create_date" DESC)
        `);

        // Per-order item aggregates and joins
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_order_item_order_status
            ON "sales_order_item" ("order_id", "status")
        `);

        // Payments lookup by order + status
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_order_status
            ON "payments" ("order_id", "status")
        `);

        // Queue by branch + status.
        // Use a quoted identifier to preserve the exact mixed-case name expected by verify scripts.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_queue_branch_status"
            ON "order_queue" ("branch_id", "status")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_order_queue_branch_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_payments_order_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_order_item_order_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_status_type_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_status_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_sales_orders_branch_created_at_desc"`);
    }
}

