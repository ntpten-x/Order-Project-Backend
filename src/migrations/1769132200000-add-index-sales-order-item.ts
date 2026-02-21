import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexSalesOrderItem1769132200000 implements MigrationInterface {
    name = 'AddIndexSalesOrderItem1769132200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF to_regclass('public.sales_order_item') IS NOT NULL THEN
                    CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_order_id" ON "sales_order_item" ("order_id");
                END IF;
            END
            $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sales_order_item_order_id"`);
    }
}
