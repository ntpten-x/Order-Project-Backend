import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStockIngredientsSearchTrigrams1772700000000 implements MigrationInterface {
    name = "AddStockIngredientsSearchTrigrams1772700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        // stock_ingredients: used by q search across display_name/ingredient_name/description
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_display_name_trgm
            ON "stock_ingredients" USING gin (display_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_ingredient_name_trgm
            ON "stock_ingredients" USING gin (ingredient_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_description_trgm
            ON "stock_ingredients" USING gin (description gin_trgm_ops)
        `);

        // Common list filters/sorts (branch isolation + active + newest/oldest).
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_branch_active_create_date
            ON "stock_ingredients" (branch_id, is_active, create_date)
        `);

        // stock_ingredients_unit: used by q search across display_name/unit_name
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_unit_display_name_trgm
            ON "stock_ingredients_unit" USING gin (display_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_unit_unit_name_trgm
            ON "stock_ingredients_unit" USING gin (unit_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_stock_ingredients_unit_branch_active_create_date
            ON "stock_ingredients_unit" (branch_id, is_active, create_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_unit_branch_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_unit_unit_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_unit_display_name_trgm`);

        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_branch_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_description_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_ingredient_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_stock_ingredients_display_name_trgm`);
    }
}

