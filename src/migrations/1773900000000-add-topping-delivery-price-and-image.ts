import { MigrationInterface, QueryRunner } from "typeorm";

export class AddToppingDeliveryPriceAndImage1773900000000 implements MigrationInterface {
    name = "AddToppingDeliveryPriceAndImage1773900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "topping"
            ADD COLUMN IF NOT EXISTS "price_delivery" decimal(12,2) NOT NULL DEFAULT 0
        `);

        await queryRunner.query(`
            ALTER TABLE "topping"
            ADD COLUMN IF NOT EXISTS "img" text NULL
        `);

        await queryRunner.query(`
            UPDATE "topping"
            SET "price_delivery" = "price"
            WHERE COALESCE("price_delivery", 0) = 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "topping" DROP COLUMN IF EXISTS "img"`);
        await queryRunner.query(`ALTER TABLE "topping" DROP COLUMN IF EXISTS "price_delivery"`);
    }
}
