import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrdersSummaryTailLatencyIndexes1772500000000 implements MigrationInterface {
    name = "AddOrdersSummaryTailLatencyIndexes1772500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Own-scope filters on summary/stats endpoints: branch + creator + latest first.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_actor_created_at_desc"
            ON "sales_orders" ("branch_id", "created_by_id", "create_date" DESC)
        `);

        // Fallback for admin/branchless own-scope reads.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_actor_created_at_desc"
            ON "sales_orders" ("created_by_id", "create_date" DESC)
        `);

        // Speeds item count aggregation for active items in summary list.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_order_item_active_order"
            ON "sales_order_item" ("order_id")
            WHERE status NOT IN ('Cancelled', 'cancelled')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_order_item_active_order"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_actor_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_actor_created_at_desc"`);
    }
}
