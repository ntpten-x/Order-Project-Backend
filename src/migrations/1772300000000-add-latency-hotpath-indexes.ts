import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLatencyHotpathIndexes1772300000000 implements MigrationInterface {
    name = "AddLatencyHotpathIndexes1772300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Speed up products list queries (branch scoped + latest first).
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_products_branch_create_date_desc"
            ON "products" ("branch_id", "create_date" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_products_branch_active_create_date_desc"
            ON "products" ("branch_id", "is_active", "create_date" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_products_branch_category_create_date_desc"
            ON "products" ("branch_id", "category_id", "create_date" DESC)
        `);

        // Align queue health/index guard and filtering hot path.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_queue_status_created_at_desc"
            ON "order_queue" ("status", "created_at" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_queue_status_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_branch_category_create_date_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_branch_active_create_date_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_products_branch_create_date_desc"`);
    }
}

