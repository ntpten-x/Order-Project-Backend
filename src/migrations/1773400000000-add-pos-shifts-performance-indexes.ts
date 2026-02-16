import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPosShiftsPerformanceIndexes1773400000000 implements MigrationInterface {
    name = "AddPosShiftsPerformanceIndexes1773400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Optimize common shift queries:
        // - current shift lookup: branch_id + status
        // - history list: branch_id + open_time (and optional status)
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_shifts_branch_open_time_desc
            ON "shifts" ("branch_id", "open_time" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_shifts_branch_status_open_time_desc
            ON "shifts" ("branch_id", "status", "open_time" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_shifts_branch_status_open_time_desc`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_shifts_branch_open_time_desc`);
    }
}

