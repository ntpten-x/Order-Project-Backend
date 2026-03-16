import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenStockIngredients1774500000000 implements MigrationInterface {
    name = "HardenStockIngredients1774500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`
            ALTER TABLE "stock_ingredients"
            ADD COLUMN IF NOT EXISTS "update_date" TIMESTAMPTZ
        `);
        await queryRunner.query(`
            UPDATE "stock_ingredients"
            SET "update_date" = COALESCE("update_date", "create_date", CURRENT_TIMESTAMP)
            WHERE "update_date" IS NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "stock_ingredients"
            ALTER COLUMN "update_date" SET DEFAULT CURRENT_TIMESTAMP
        `);
        await queryRunner.query(`
            ALTER TABLE "stock_ingredients"
            ALTER COLUMN "update_date" SET NOT NULL
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_branch_display_name_normalized"
            ON "stock_ingredients" ("branch_id", LOWER(TRIM("display_name")))
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_ingredients_display_name_trgm"
            ON "stock_ingredients" USING GIN (LOWER("display_name") gin_trgm_ops)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_ingredients_display_name_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_branch_display_name_normalized"`);
        await queryRunner.query(`
            ALTER TABLE "stock_ingredients"
            DROP COLUMN IF EXISTS "update_date"
        `);
    }
}
