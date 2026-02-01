import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderQueueAndPromotions1770100000000 implements MigrationInterface {
    name = 'AddOrderQueueAndPromotions1770100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if order_queue table exists
        const orderQueueTableExists = await queryRunner.hasTable("order_queue");
        
        if (!orderQueueTableExists) {
            // Create enum types
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

            // Create order_queue table
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
        }

        // Create indexes for order_queue (IF NOT EXISTS)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_queue_order_id" ON "order_queue" ("order_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_queue_branch_status" ON "order_queue" ("branch_id", "status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_order_queue_priority_created" ON "order_queue" ("priority", "created_at")`);

        // Create foreign keys for order_queue (IF NOT EXISTS)
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

        // Check if promotions table exists
        const promotionsTableExists = await queryRunner.hasTable("promotions");
        
        if (!promotionsTableExists) {
            // Create enum types for promotions
            await queryRunner.query(`DO $$ BEGIN
                CREATE TYPE "promotions_promotion_type_enum" AS ENUM('BuyXGetY', 'PercentageOff', 'FixedAmountOff', 'FreeShipping', 'Bundle', 'MinimumPurchase');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`);

            await queryRunner.query(`DO $$ BEGIN
                CREATE TYPE "promotions_condition_type_enum" AS ENUM('AllProducts', 'SpecificCategory', 'SpecificProduct', 'MinimumAmount');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;`);

            // Create promotions table
            await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS "promotions" (
                    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                    "promotion_code" varchar(50) NOT NULL,
                    "name" varchar(200) NOT NULL,
                    "description" text,
                    "branch_id" uuid,
                    "promotion_type" "promotions_promotion_type_enum" NOT NULL,
                    "condition_type" "promotions_condition_type_enum" NOT NULL,
                    "condition_value" text,
                    "discount_amount" decimal(12,2),
                    "discount_percentage" decimal(12,2),
                    "minimum_purchase" decimal(12,2),
                    "buy_quantity" integer,
                    "get_quantity" integer,
                    "start_date" timestamptz,
                    "end_date" timestamptz,
                    "usage_limit" integer NOT NULL DEFAULT 0,
                    "usage_count" integer NOT NULL DEFAULT 0,
                    "usage_limit_per_user" integer NOT NULL DEFAULT 1,
                    "is_active" boolean NOT NULL DEFAULT true,
                    "create_date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "update_date" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT "PK_promotions" PRIMARY KEY ("id")
                )
            `);
        }

        // Create indexes for promotions (IF NOT EXISTS)
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotions_code_branch" ON "promotions" ("promotion_code", "branch_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_promotions_branch_active" ON "promotions" ("branch_id", "is_active")`);

        // Create foreign key for promotions (IF NOT EXISTS)
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "promotions" 
                ADD CONSTRAINT "FK_promotions_branch_id" 
                FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys
        await queryRunner.query(`ALTER TABLE "order_queue" DROP CONSTRAINT IF EXISTS "FK_order_queue_order_id"`);
        await queryRunner.query(`ALTER TABLE "order_queue" DROP CONSTRAINT IF EXISTS "FK_order_queue_branch_id"`);
        await queryRunner.query(`ALTER TABLE "promotions" DROP CONSTRAINT IF EXISTS "FK_promotions_branch_id"`);

        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_queue_order_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_queue_branch_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_queue_priority_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_promotions_code_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_promotions_branch_active"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS "order_queue"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);

        // Drop enum types (only if no other tables use them)
        await queryRunner.query(`DROP TYPE IF EXISTS "order_queue_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "order_queue_priority_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "promotions_promotion_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "promotions_condition_type_enum"`);
    }
}
