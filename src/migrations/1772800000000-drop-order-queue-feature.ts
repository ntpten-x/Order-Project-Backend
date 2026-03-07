import { MigrationInterface, QueryRunner } from "typeorm";

export class DropOrderQueueFeature1772800000000 implements MigrationInterface {
    name = "DropOrderQueueFeature1772800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "role_permissions"
            WHERE "resource_id" IN (
                SELECT "id"
                FROM "permission_resources"
                WHERE "resource_key" IN ('queue.page', 'menu.pos.kitchen')
            )
        `);

        await queryRunner.query(`
            DELETE FROM "user_permissions"
            WHERE "resource_id" IN (
                SELECT "id"
                FROM "permission_resources"
                WHERE "resource_key" IN ('queue.page', 'menu.pos.kitchen')
            )
        `);

        await queryRunner.query(`
            DELETE FROM "permission_resources"
            WHERE "resource_key" IN ('queue.page', 'menu.pos.kitchen')
        `);

        await queryRunner.query(`DROP TABLE IF EXISTS "order_queue" CASCADE`);
        await queryRunner.query(`DROP TYPE IF EXISTS "order_queue_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "order_queue_priority_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "order_queue_status_enum" AS ENUM('Pending', 'Processing', 'Completed', 'Cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);

        await queryRunner.query(`DO $$ BEGIN
            CREATE TYPE "order_queue_priority_enum" AS ENUM('Low', 'Normal', 'High', 'Urgent');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "order_queue" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "order_id" uuid NOT NULL,
                "branch_id" uuid,
                "status" "order_queue_status_enum" NOT NULL DEFAULT 'Pending',
                "priority" "order_queue_priority_enum" NOT NULL DEFAULT 'Normal',
                "queue_position" integer NOT NULL DEFAULT 0,
                "started_at" timestamptz,
                "completed_at" timestamptz,
                "notes" text,
                "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "PK_order_queue" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_queue_order_id"
            ON "order_queue" ("order_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_queue_branch_status"
            ON "order_queue" ("branch_id", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_order_queue_priority_created"
            ON "order_queue" ("priority", "created_at")
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "order_queue"
                ADD CONSTRAINT "FK_order_queue_order_id"
                FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "order_queue"
                ADD CONSTRAINT "FK_order_queue_branch_id"
                FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            INSERT INTO "permission_resources" (
                "resource_key",
                "resource_name",
                "route_pattern",
                "resource_type",
                "sort_order",
                "is_active"
            )
            VALUES
                ('queue.page', 'Queue', '/pos/queue', 'page', 24, true),
                ('menu.pos.kitchen', 'POS Menu - Kitchen', '/pos/kitchen', 'menu', 2023, true)
            ON CONFLICT ("resource_key") DO NOTHING
        `);
    }
}
