import { MigrationInterface, QueryRunner } from "typeorm";

export class AddServingBoardColumns1772700000000 implements MigrationInterface {
    name = "AddServingBoardColumns1772700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

        await queryRunner.query(`
            ALTER TABLE "sales_order_item"
            ADD COLUMN IF NOT EXISTS "serving_group_id" uuid
        `);
        await queryRunner.query(`
            ALTER TABLE "sales_order_item"
            ADD COLUMN IF NOT EXISTS "serving_group_created_at" TIMESTAMPTZ
        `);
        await queryRunner.query(`
            ALTER TABLE "sales_order_item"
            ADD COLUMN IF NOT EXISTS "serving_status" character varying(32)
        `);

        await queryRunner.query(`
            WITH active_order_groups AS (
                SELECT
                    so.id AS order_id,
                    gen_random_uuid() AS serving_group_id,
                    COALESCE(so.update_date, so.create_date, CURRENT_TIMESTAMP) AS serving_group_created_at
                FROM sales_orders so
                WHERE so.status::text IN ('Pending', 'pending', 'Cooking', 'Served')
            )
            UPDATE sales_order_item soi
            SET
                serving_group_id = COALESCE(soi.serving_group_id, aog.serving_group_id),
                serving_group_created_at = COALESCE(soi.serving_group_created_at, aog.serving_group_created_at),
                serving_status = COALESCE(
                    soi.serving_status,
                    CASE
                        WHEN soi.status::text IN ('Served', 'Paid') THEN 'Served'
                        ELSE 'PendingServe'
                    END
                )
            FROM active_order_groups aog
            WHERE soi.order_id = aog.order_id
        `);

        await queryRunner.query(`
            UPDATE sales_order_item
            SET
                serving_group_id = COALESCE(serving_group_id, gen_random_uuid()),
                serving_group_created_at = COALESCE(serving_group_created_at, CURRENT_TIMESTAMP),
                serving_status = COALESCE(serving_status, 'PendingServe')
        `);

        await queryRunner.query(`
            ALTER TABLE "sales_order_item"
            ALTER COLUMN "serving_group_id" SET DEFAULT gen_random_uuid(),
            ALTER COLUMN "serving_group_id" SET NOT NULL,
            ALTER COLUMN "serving_group_created_at" SET DEFAULT CURRENT_TIMESTAMP,
            ALTER COLUMN "serving_group_created_at" SET NOT NULL,
            ALTER COLUMN "serving_status" SET DEFAULT 'PendingServe',
            ALTER COLUMN "serving_status" SET NOT NULL
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_serving_group_id"
            ON "sales_order_item" ("serving_group_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_serving_group_created_at"
            ON "sales_order_item" ("serving_group_created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_serving_status"
            ON "sales_order_item" ("serving_status")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_order_serving_group"
            ON "sales_order_item" ("order_id", "serving_group_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_item_order_serving_group"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_item_serving_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_item_serving_group_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_item_serving_group_id"`);

        await queryRunner.query(`
            ALTER TABLE "sales_order_item"
            DROP COLUMN IF EXISTS "serving_status",
            DROP COLUMN IF EXISTS "serving_group_created_at",
            DROP COLUMN IF EXISTS "serving_group_id"
        `);
    }
}
