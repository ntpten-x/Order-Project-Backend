import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderQueuePerformanceIndexes1772200000000 implements MigrationInterface {
    name = "AddOrderQueuePerformanceIndexes1772200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_queue_branch_status_priority_position"
            ON "order_queue" ("branch_id", "status", "priority", "queue_position")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_queue_branch_created_position_desc"
            ON "order_queue" ("branch_id", "created_at" DESC, "queue_position" DESC)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_queue_branch_created_position_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_queue_branch_status_priority_position"`);
    }
}

