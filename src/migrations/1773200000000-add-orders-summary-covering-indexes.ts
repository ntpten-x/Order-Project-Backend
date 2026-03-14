import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrdersSummaryCoveringIndexes1773200000000 implements MigrationInterface {
    name = "AddOrdersSummaryCoveringIndexes1773200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_created_at_desc_covering"
            ON "sales_orders" ("branch_id", "create_date" DESC)
            INCLUDE ("order_no", "order_type", "status", "total_amount", "delivery_code", "customer_name", "table_id", "delivery_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_status_type_created_at_desc_covering"
            ON "sales_orders" ("branch_id", "status", "order_type", "create_date" DESC)
            INCLUDE ("order_no", "total_amount", "delivery_code", "customer_name", "table_id", "delivery_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_actor_created_at_desc_covering"
            ON "sales_orders" ("branch_id", "created_by_id", "create_date" DESC)
            INCLUDE ("order_no", "order_type", "status", "total_amount", "delivery_code", "customer_name", "table_id", "delivery_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_order_item_active_order_covering"
            ON "sales_order_item" ("order_id")
            INCLUDE ("quantity")
            WHERE "status" NOT IN ('Cancelled', 'cancelled')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_order_item_active_order_covering"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_actor_created_at_desc_covering"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_status_type_created_at_desc_covering"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_created_at_desc_covering"`);
    }
}
