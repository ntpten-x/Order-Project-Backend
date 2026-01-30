import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndicesToPOSEntities1769134208985 implements MigrationInterface {
    name = 'AddIndicesToPOSEntities1769134208985'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_sales_order_item_order_id"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_21278276a20cd242a6ba10efc0" ON "tables" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_894a8151f2433fca9b81acb297" ON "products" ("product_name") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_4759a2cc727c8989652f479c64" ON "sales_order_item" ("order_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dc1e84f1d1e75e990952c40859" ON "shifts" ("user_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3e044af0f8d48f964102ee2bf6" ON "shifts" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b2f7b823a21562eeca20e72b00" ON "payments" ("order_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_b9629005079d9c0ca515deb795" ON "payments" ("shift_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_308797ee916b40fc1cc4fc46cf" ON "sales_orders" ("table_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_308797ee916b40fc1cc4fc46cf"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b9629005079d9c0ca515deb795"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b2f7b823a21562eeca20e72b00"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_3e044af0f8d48f964102ee2bf6"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_dc1e84f1d1e75e990952c40859"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4759a2cc727c8989652f479c64"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_894a8151f2433fca9b81acb297"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_21278276a20cd242a6ba10efc0"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_sales_order_item_order_id" ON "sales_order_item" ("order_id") `);
    }

}
