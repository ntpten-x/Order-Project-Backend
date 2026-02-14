import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditRetentionDeletePolicy1772100000000 implements MigrationInterface {
    name = "AddAuditRetentionDeletePolicy1772100000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at"
            ON "audit_logs" ("created_at")
        `);

        await queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_delete" ON "audit_logs"`);
        await queryRunner.query(`
            CREATE POLICY "audit_logs_delete" ON "audit_logs"
            FOR DELETE
            USING (app.is_admin() AND app.current_branch_id() IS NULL)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP POLICY IF EXISTS "audit_logs_delete" ON "audit_logs"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_at"`);
    }
}

