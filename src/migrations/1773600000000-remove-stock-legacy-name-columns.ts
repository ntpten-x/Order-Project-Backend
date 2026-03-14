import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveStockLegacyNameColumns1773600000000 implements MigrationInterface {
    name = "RemoveStockLegacyNameColumns1773600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_name_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_ingredients_unit_name_branch"`);
        await queryRunner.query(`ALTER TABLE "stock_ingredients" DROP COLUMN IF EXISTS "ingredient_name"`);
        await queryRunner.query(`ALTER TABLE "stock_ingredients_unit" DROP COLUMN IF EXISTS "unit_name"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_ingredients" ADD COLUMN IF NOT EXISTS "ingredient_name" character varying(100)`);
        await queryRunner.query(`UPDATE "stock_ingredients" SET "ingredient_name" = COALESCE("display_name", '') WHERE "ingredient_name" IS NULL`);
        await queryRunner.query(`ALTER TABLE "stock_ingredients" ALTER COLUMN "ingredient_name" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_name_branch" ON "stock_ingredients" ("ingredient_name", "branch_id") WHERE "branch_id" IS NOT NULL`);

        await queryRunner.query(`ALTER TABLE "stock_ingredients_unit" ADD COLUMN IF NOT EXISTS "unit_name" character varying(100)`);
        await queryRunner.query(`UPDATE "stock_ingredients_unit" SET "unit_name" = COALESCE("display_name", '') WHERE "unit_name" IS NULL`);
        await queryRunner.query(`ALTER TABLE "stock_ingredients_unit" ALTER COLUMN "unit_name" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_ingredients_unit_name_branch" ON "stock_ingredients_unit" ("unit_name", "branch_id") WHERE "branch_id" IS NOT NULL`);
    }
}
