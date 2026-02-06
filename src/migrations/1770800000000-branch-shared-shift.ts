import { MigrationInterface, QueryRunner } from "typeorm";

export class BranchSharedShift1770800000000 implements MigrationInterface {
    name = "BranchSharedShift1770800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "opened_by_user_id" uuid`);
        await queryRunner.query(`ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "closed_by_user_id" uuid`);

        await queryRunner.query(`
            UPDATE "shifts"
            SET "opened_by_user_id" = "user_id"
            WHERE "opened_by_user_id" IS NULL
        `);

        // Keep only one active shift per branch by closing older duplicates.
        await queryRunner.query(`
            WITH ranked_open AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY branch_id
                        ORDER BY open_time DESC, create_date DESC, id DESC
                    ) AS rn
                FROM shifts
                WHERE status = 'OPEN'
            )
            UPDATE shifts s
            SET
                status = 'CLOSED',
                close_time = COALESCE(s.close_time, NOW()),
                closed_by_user_id = COALESCE(s.closed_by_user_id, s.opened_by_user_id, s.user_id),
                update_date = NOW()
            FROM ranked_open r
            WHERE s.id = r.id
              AND r.rn > 1
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shifts_one_open_per_branch"
            ON "shifts" ("branch_id")
            WHERE "status" = 'OPEN'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_shifts_one_open_per_branch"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "closed_by_user_id"`);
        await queryRunner.query(`ALTER TABLE "shifts" DROP COLUMN IF EXISTS "opened_by_user_id"`);
    }
}
