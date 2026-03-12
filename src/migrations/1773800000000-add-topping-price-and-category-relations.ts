import { MigrationInterface, QueryRunner } from "typeorm";

export class AddToppingPriceAndCategoryRelations1773800000000 implements MigrationInterface {
    name = "AddToppingPriceAndCategoryRelations1773800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "topping"
            ADD COLUMN IF NOT EXISTS "price" decimal(12,2) NOT NULL DEFAULT 0
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "topping_categories" (
                "topping_id" uuid NOT NULL,
                "category_id" uuid NOT NULL,
                CONSTRAINT "PK_topping_categories" PRIMARY KEY ("topping_id", "category_id"),
                CONSTRAINT "FK_topping_categories_topping" FOREIGN KEY ("topping_id") REFERENCES "topping"("id") ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT "FK_topping_categories_category" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_topping_categories_topping_id"
            ON "topping_categories" ("topping_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_topping_categories_category_id"
            ON "topping_categories" ("category_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_topping_categories_category_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_topping_categories_topping_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "topping_categories"`);
        await queryRunner.query(`ALTER TABLE "topping" DROP COLUMN IF EXISTS "price"`);
    }
}
