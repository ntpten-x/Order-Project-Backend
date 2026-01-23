import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexSalesOrderItem1769132200000 implements MigrationInterface {
    name = 'AddIndexSalesOrderItem1769132200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_sales_order_item_order_id" ON "sales_order_item" ("order_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_sales_order_item_order_id"`);
    }
}
