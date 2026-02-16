import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranchSearchTrigrams1772300000000 implements MigrationInterface {
    name = "AddBranchSearchTrigrams1772300000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Trigram indexes speed up ILIKE '%keyword%' searches.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_branches_branch_name_trgm
            ON "branches" USING gin (branch_name gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_branches_branch_code_trgm
            ON "branches" USING gin (branch_code gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_branches_address_trgm
            ON "branches" USING gin (address gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_branches_phone_trgm
            ON "branches" USING gin (phone gin_trgm_ops)
        `);

        // Helps common list patterns: optional is_active filter + sort by create_date.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_branches_is_active_create_date
            ON "branches" (is_active, create_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_branches_is_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_branches_phone_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_branches_address_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_branches_branch_code_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_branches_branch_name_trgm`);
    }
}

