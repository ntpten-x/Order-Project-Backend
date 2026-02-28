import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrintSettings1772600000000 implements MigrationInterface {
    name = "AddPrintSettings1772600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "print_settings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "branch_id" uuid NOT NULL,
                "default_unit" character varying(10) NOT NULL DEFAULT 'mm',
                "locale" character varying(20) NOT NULL DEFAULT 'th-TH',
                "allow_manual_override" boolean NOT NULL DEFAULT true,
                "documents" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "automation" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_print_settings_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_print_settings_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_print_settings_branch_id" ON "print_settings" ("branch_id")`
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_print_settings_updated_at" ON "print_settings" ("updated_at")`
        );

        await queryRunner.query(`ALTER TABLE "print_settings" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "print_settings" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "print_settings"`);
        await queryRunner.query(`
            CREATE POLICY "branch_isolation" ON "print_settings"
            USING (app.is_admin() OR "branch_id" = app.current_branch_id())
            WITH CHECK (app.is_admin() OR "branch_id" = app.current_branch_id())
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "print_settings"`);
        await queryRunner.query(`ALTER TABLE "print_settings" DISABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_print_settings_updated_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_print_settings_branch_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "print_settings"`);
    }
}
