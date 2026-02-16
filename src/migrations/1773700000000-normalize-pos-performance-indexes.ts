import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizePosPerformanceIndexes1773700000000 implements MigrationInterface {
    name = "NormalizePosPerformanceIndexes1773700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure required POS performance indexes exist.
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
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sales_order_item_order_status
            ON "sales_order_item" ("order_id", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payments_order_status
            ON "payments" ("order_id", "status")
        `);

        // Normalize order_queue index name to a single canonical identifier
        // expected by verification scripts.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF to_regclass('public."IDX_order_queue_branch_status"') IS NULL
                   AND to_regclass('public.idx_order_queue_branch_status') IS NOT NULL THEN
                    ALTER INDEX public.idx_order_queue_branch_status
                    RENAME TO "IDX_order_queue_branch_status";
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_queue_branch_status"
            ON "order_queue" ("branch_id", "status")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF to_regclass('public."IDX_order_queue_branch_status"') IS NOT NULL
                   AND to_regclass('public.idx_order_queue_branch_status') IS NOT NULL THEN
                    DROP INDEX public.idx_order_queue_branch_status;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Roll back only naming normalization on order_queue index.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF to_regclass('public.idx_order_queue_branch_status') IS NULL
                   AND to_regclass('public."IDX_order_queue_branch_status"') IS NOT NULL THEN
                    ALTER INDEX public."IDX_order_queue_branch_status"
                    RENAME TO idx_order_queue_branch_status;
                END IF;
            END $$;
        `);
    }
}
