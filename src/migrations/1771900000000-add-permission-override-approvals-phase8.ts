import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionOverrideApprovalsPhase81771900000000 implements MigrationInterface {
    name = "AddPermissionOverrideApprovalsPhase81771900000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permission_override_approvals" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "target_user_id" uuid NOT NULL,
                "requested_by_user_id" uuid NOT NULL,
                "reviewed_by_user_id" uuid,
                "status" character varying(20) NOT NULL DEFAULT 'pending',
                "reason" text,
                "review_reason" text,
                "risk_flags" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "permissions_payload" jsonb NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "reviewed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_permission_override_approvals_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_permission_override_approvals_target_user" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_permission_override_approvals_requested_by" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_permission_override_approvals_reviewed_by" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
                CONSTRAINT "CHK_permission_override_approvals_status" CHECK ("status" IN ('pending', 'approved', 'rejected'))
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_override_approvals_status_created_at"
            ON "permission_override_approvals" ("status", "created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_override_approvals_target_status"
            ON "permission_override_approvals" ("target_user_id", "status", "created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_override_approvals_requested_by_created_at"
            ON "permission_override_approvals" ("requested_by_user_id", "created_at" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "permission_override_approvals"`);
    }
}

