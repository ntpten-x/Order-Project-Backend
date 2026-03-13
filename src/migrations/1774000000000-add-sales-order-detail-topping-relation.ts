import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSalesOrderDetailToppingRelation1774000000000 implements MigrationInterface {
    name = "AddSalesOrderDetailToppingRelation1774000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sales_order_detail"
            ADD COLUMN IF NOT EXISTS "topping_id" uuid
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_sales_order_detail_topping_id"
            ON "sales_order_detail" ("topping_id")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_sales_order_detail_topping_id'
                ) THEN
                    ALTER TABLE "sales_order_detail"
                    ADD CONSTRAINT "FK_sales_order_detail_topping_id"
                    FOREIGN KEY ("topping_id")
                    REFERENCES "topping"("id")
                    ON DELETE SET NULL
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sales_order_detail"
            DROP CONSTRAINT IF EXISTS "FK_sales_order_detail_topping_id"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_sales_order_detail_topping_id"
        `);

        await queryRunner.query(`
            ALTER TABLE "sales_order_detail"
            DROP COLUMN IF EXISTS "topping_id"
        `);
    }
}
