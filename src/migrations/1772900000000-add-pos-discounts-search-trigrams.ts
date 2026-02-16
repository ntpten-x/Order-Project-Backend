import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPosDiscountsSearchTrigrams1772900000000 implements MigrationInterface {
    name = "AddPosDiscountsSearchTrigrams1772900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_discounts_discount_name_trgm
            ON "discounts" USING gin (discount_name gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_discounts_display_name_trgm
            ON "discounts" USING gin (display_name gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_discounts_description_trgm
            ON "discounts" USING gin (description gin_trgm_ops)
        `);

        // Common listing pattern: branch scoped + active filter + newest first
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_discounts_branch_active_create_date
            ON "discounts" (branch_id, is_active, create_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_discounts_branch_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_discounts_description_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_discounts_display_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_discounts_discount_name_trgm`);
    }
}

