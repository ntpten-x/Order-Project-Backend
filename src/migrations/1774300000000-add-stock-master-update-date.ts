import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStockMasterUpdateDate1774300000000 implements MigrationInterface {
    name = "AddStockMasterUpdateDate1774300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`
            ALTER TABLE "stock_ingredients_unit"
            ADD COLUMN IF NOT EXISTS "update_date" TIMESTAMPTZ
        `);
        await queryRunner.query(`
            UPDATE "stock_ingredients_unit"
            SET "update_date" = COALESCE("update_date", "create_date", CURRENT_TIMESTAMP)
            WHERE "update_date" IS NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "stock_ingredients_unit"
            ALTER COLUMN "update_date" SET DEFAULT CURRENT_TIMESTAMP
        `);
        await queryRunner.query(`
            ALTER TABLE "stock_ingredients_unit"
            ALTER COLUMN "update_date" SET NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`
            ALTER TABLE "stock_ingredients_unit"
            DROP COLUMN IF EXISTS "update_date"
        `);
    }
}
