import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrdersSummaryStatsCacheMissIndexes1773100000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_status_active_stats"
            ON "sales_orders" ("branch_id", "status")
            WHERE "status" IN ('Pending', 'Cooking', 'Served', 'WaitingForPayment')
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename = 'sales_orders'
                      AND indexdef ILIKE '%ON "sales_orders" ("branch_id", "create_date" DESC)%'
                ) THEN
                    CREATE INDEX "idx_sales_orders_branch_create_date_desc_cache_miss"
                    ON "sales_orders" ("branch_id", "create_date" DESC);
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_create_date_desc_cache_miss"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_status_active_stats"`);
    }
}
