import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsersSearchTrigrams1772400000000 implements MigrationInterface {
    name = "AddUsersSearchTrigrams1772400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Trigram indexes speed up ILIKE '%keyword%' searches.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_username_trgm
            ON "users" USING gin (username gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_name_trgm
            ON "users" USING gin (name gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_roles_roles_name_trgm
            ON "roles" USING gin (roles_name gin_trgm_ops)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_roles_display_name_trgm
            ON "roles" USING gin (display_name gin_trgm_ops)
        `);

        // Helps common list patterns: scoped by branch_id + sort by create_date.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_branch_id_create_date
            ON "users" (branch_id, create_date)
        `);

        // Helps filters + default sorting.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_users_is_active_create_date
            ON "users" (is_active, create_date)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_is_active_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_branch_id_create_date`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_display_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_roles_roles_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_name_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_users_username_trgm`);
    }
}

