import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPosProductsProductsUnitPaymentMethodSearchTrigrams1773200000000 implements MigrationInterface {
    name = "AddPosProductsProductsUnitPaymentMethodSearchTrigrams1773200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        // Products
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_product_name_trgm
            ON "products" USING gin (product_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_display_name_trgm
            ON "products" USING gin (display_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_description_trgm
            ON "products" USING gin (description gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_branch_active_create_date
            ON "products" (branch_id, is_active, create_date)
        `);

        // Product Units
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_unit_unit_name_trgm
            ON "products_unit" USING gin (unit_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_unit_display_name_trgm
            ON "products_unit" USING gin (display_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_products_unit_branch_active_create_date
            ON "products_unit" (branch_id, is_active, create_date)
        `);

        // Payment Methods
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_method_display_name_trgm
            ON "payment_method" USING gin (display_name gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_payment_method_branch_active_create_date
            ON "payment_method" (branch_id, is_active, create_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_method_branch_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_payment_method_display_name_trgm`);

        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_unit_branch_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_unit_display_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_unit_unit_name_trgm`);

        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_branch_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_description_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_display_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_products_product_name_trgm`);
    }
}

