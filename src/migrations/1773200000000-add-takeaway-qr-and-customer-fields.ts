import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTakeawayQrAndCustomerFields1773200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "shop_profile"
            ADD COLUMN IF NOT EXISTS "takeaway_qr_token" varchar(128)
        `);

        await queryRunner.query(`
            ALTER TABLE "shop_profile"
            ADD COLUMN IF NOT EXISTS "takeaway_qr_expires_at" TIMESTAMPTZ
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "uq_shop_profile_takeaway_qr_token"
            ON "shop_profile" ("takeaway_qr_token")
            WHERE "takeaway_qr_token" IS NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "sales_orders"
            ADD COLUMN IF NOT EXISTS "customer_name" varchar(120)
        `);

        await queryRunner.query(`
            ALTER TABLE "sales_orders"
            ADD COLUMN IF NOT EXISTS "customer_phone" varchar(20)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_customer_name"
            ON "sales_orders" ("branch_id", "customer_name")
            WHERE "customer_name" IS NOT NULL
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_customer_phone"
            ON "sales_orders" ("branch_id", "customer_phone")
            WHERE "customer_phone" IS NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_customer_phone"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_customer_name"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "customer_phone"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "customer_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "uq_shop_profile_takeaway_qr_token"`);
        await queryRunner.query(`ALTER TABLE "shop_profile" DROP COLUMN IF EXISTS "takeaway_qr_expires_at"`);
        await queryRunner.query(`ALTER TABLE "shop_profile" DROP COLUMN IF EXISTS "takeaway_qr_token"`);
    }
}
