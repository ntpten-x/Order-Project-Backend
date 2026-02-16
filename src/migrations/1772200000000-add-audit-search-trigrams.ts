import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditSearchTrigrams1772200000000 implements MigrationInterface {
    name = "AddAuditSearchTrigrams1772200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Speeds up `ILIKE '%term%'` search patterns.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_username_trgm
            ON "audit_logs" USING gin (username gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_description_trgm
            ON "audit_logs" USING gin (description gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type_trgm
            ON "audit_logs" USING gin (entity_type gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type_trgm
            ON "audit_logs" USING gin (action_type gin_trgm_ops)
        `);

        // Common filter + sort pattern (branch-scoped pages ordered by time).
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_id_created_at
            ON "audit_logs" (branch_id, created_at)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_branch_id_created_at`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_action_type_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_entity_type_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_description_trgm`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_username_trgm`);
    }
}

