import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCustomerPhoneFromSalesOrders1773300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_orders_branch_customer_phone"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP COLUMN IF EXISTS "customer_phone"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sales_orders"
            ADD COLUMN IF NOT EXISTS "customer_phone" varchar(20)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_sales_orders_branch_customer_phone"
            ON "sales_orders" ("branch_id", "customer_phone")
            WHERE "customer_phone" IS NOT NULL
        `);
    }
}
