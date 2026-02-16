import { MigrationInterface, QueryRunner } from "typeorm";

// Defense-in-depth: some environments missed the original POS trigram migration.
// Keep names stable because verification scripts assert on these names.
export class EnsurePosTablesDeliverySearchTrigrams1773000000000 implements MigrationInterface {
    name = "EnsurePosTablesDeliverySearchTrigrams1773000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_tables_table_name_trgm
            ON "tables" USING gin (table_name gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_delivery_delivery_name_trgm
            ON "delivery" USING gin (delivery_name gin_trgm_ops)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_delivery_delivery_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_tables_table_name_trgm`);
    }
}

