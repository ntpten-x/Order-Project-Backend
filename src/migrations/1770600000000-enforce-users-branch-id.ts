import { MigrationInterface, QueryRunner } from "typeorm";

export class EnforceUsersBranchId1770600000000 implements MigrationInterface {
    name = "EnforceUsersBranchId1770600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Performance: common filters in admin user management and reporting
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_users_branch_id" ON "users" ("branch_id")`);

        // Backfill legacy NULL branch_id rows (to avoid "invisible" users after branch scoping).
        const nullRows = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "users" WHERE "branch_id" IS NULL`);
        const nullCount = Number(nullRows?.[0]?.count ?? 0);

        if (nullCount > 0) {
            const countRows = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "branches"`);
            const branchCount = Number(countRows?.[0]?.count ?? 0);

            const envBackfillBranchId = (process.env.BRANCH_BACKFILL_ID || process.env.DEFAULT_BRANCH_ID || "").trim();
            let backfillBranchId = envBackfillBranchId || "";

            if (!backfillBranchId) {
                if (branchCount === 0) {
                    throw new Error(
                        'Migration requires at least one row in "branches". Create a branch first, then rerun migrations.'
                    );
                }
                if (branchCount > 1) {
                    throw new Error(
                        'Multiple branches exist; set env BRANCH_BACKFILL_ID (uuid) to backfill NULL users.branch_id safely.'
                    );
                }

                const idRows = await queryRunner.query(`SELECT id FROM "branches" LIMIT 1`);
                backfillBranchId = String(idRows?.[0]?.id ?? "").trim();
            }

            if (!backfillBranchId) {
                throw new Error("Failed to resolve a backfill branch id (BRANCH_BACKFILL_ID/DEFAULT_BRANCH_ID).");
            }

            await queryRunner.query(`UPDATE "users" SET "branch_id" = $1 WHERE "branch_id" IS NULL`, [
                backfillBranchId,
            ]);
        }

        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "branch_id" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "branch_id" DROP NOT NULL`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_branch_id"`);
    }
}

