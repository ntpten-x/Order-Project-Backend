import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionAuditsPhase41771500000000 implements MigrationInterface {
    name = "AddPermissionAuditsPhase41771500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permission_audits" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "actor_user_id" uuid NOT NULL,
                "target_type" character varying(10) NOT NULL,
                "target_id" uuid NOT NULL,
                "action_type" character varying(30) NOT NULL,
                "payload_before" jsonb,
                "payload_after" jsonb,
                "reason" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_permission_audits_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_permission_audits_target_type" CHECK ("target_type" IN ('role','user'))
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_audits_target_created_at"
            ON "permission_audits" ("target_type", "target_id", "created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_audits_actor_created_at"
            ON "permission_audits" ("actor_user_id", "created_at" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "permission_audits"`);
    }
}
