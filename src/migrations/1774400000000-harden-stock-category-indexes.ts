import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenStockCategoryIndexes1774400000000 implements MigrationInterface {
    name = "HardenStockCategoryIndexes1774400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_categories_branch_display_name_normalized"
            ON "stock_categories" ("branch_id", LOWER(TRIM("display_name")))
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_categories_display_name_trgm"
            ON "stock_categories" USING GIN (LOWER("display_name") gin_trgm_ops)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_categories_display_name_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_categories_branch_display_name_normalized"`);
    }
}
