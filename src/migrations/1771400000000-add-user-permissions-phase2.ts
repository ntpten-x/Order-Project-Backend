import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPermissionsPhase21771400000000 implements MigrationInterface {
    name = "AddUserPermissionsPhase21771400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "user_permissions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "resource_id" uuid NOT NULL,
                "action_id" uuid NOT NULL,
                "effect" character varying(10) NOT NULL,
                "scope" character varying(20) NOT NULL DEFAULT 'none',
                "condition_json" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_permissions_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_user_permissions_user_resource_action" UNIQUE ("user_id", "resource_id", "action_id"),
                CONSTRAINT "FK_user_permissions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_user_permissions_resource_id" FOREIGN KEY ("resource_id") REFERENCES "permission_resources"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_user_permissions_action_id" FOREIGN KEY ("action_id") REFERENCES "permission_actions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "CHK_user_permissions_effect" CHECK ("effect" IN ('allow','deny')),
                CONSTRAINT "CHK_user_permissions_scope" CHECK ("scope" IN ('none','own','branch','all'))
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_user_permissions_user"
            ON "user_permissions" ("user_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "user_permissions"`);
    }
}
