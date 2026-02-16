import { MigrationInterface, QueryRunner } from "typeorm";

export class EnsurePaymentMethodNameTrgm1773300000000 implements MigrationInterface {
    name = "EnsurePaymentMethodNameTrgm1773300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_method_name_trgm
            ON "payment_method" USING gin (payment_method_name gin_trgm_ops)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_method_name_trgm`);
    }
}

