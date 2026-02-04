import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductsPriceDelivery1770700000000 implements MigrationInterface {
    name = "AddProductsPriceDelivery1770700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_delivery" numeric(12,2)`
        );

        // Backfill legacy rows (default delivery price = store price)
        await queryRunner.query(
            `UPDATE "products" SET "price_delivery" = "price" WHERE "price_delivery" IS NULL`
        );

        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "price_delivery" SET DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "products" ALTER COLUMN "price_delivery" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "price_delivery"`);
    }
}

