import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderIndexes1769798400000 implements MigrationInterface {
    name = 'AddOrderIndexes1769798400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_orders_order_type" ON "sales_orders" ("order_type")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_orders_delivery_id" ON "sales_orders" ("delivery_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_status" ON "sales_order_item" ("status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_order_item_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_orders_delivery_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_orders_order_type"`);
    }
}
