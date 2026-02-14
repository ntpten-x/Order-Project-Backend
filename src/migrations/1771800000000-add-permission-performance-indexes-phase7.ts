import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPermissionPerformanceIndexesPhase71771800000000 implements MigrationInterface {
    name = "AddPermissionPerformanceIndexesPhase71771800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Cover permission decision lookups while preserving existing uniqueness constraints.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_role_permissions_lookup_cover"
            ON "role_permissions" ("role_id", "resource_id", "action_id")
            INCLUDE ("effect", "scope")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_user_permissions_lookup_cover"
            ON "user_permissions" ("user_id", "resource_id", "action_id")
            INCLUDE ("effect", "scope")
        `);

        // Speed up audit listing, access review windows, and stale review joins.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_audits_created_at_desc"
            ON "permission_audits" ("created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_audits_action_created_at"
            ON "permission_audits" ("action_type", "created_at" DESC)
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_permission_audits_target_action_created_at"
            ON "permission_audits" ("target_type", "target_id", "action_type", "created_at" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_permission_audits_target_action_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_permission_audits_action_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_permission_audits_created_at_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_permissions_lookup_cover"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_role_permissions_lookup_cover"`);
    }
}

