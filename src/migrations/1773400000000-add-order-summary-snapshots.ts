import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderSummarySnapshots1773400000000 implements MigrationInterface {
    name = "AddOrderSummarySnapshots1773400000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "order_summary_snapshots" (
                "order_id" uuid PRIMARY KEY,
                "branch_id" uuid NOT NULL,
                "created_by_id" uuid NULL,
                "order_no" varchar NULL,
                "order_type" "public"."sales_orders_order_type_enum" NOT NULL,
                "status" "public"."sales_orders_status_enum" NOT NULL,
                "create_date" timestamptz NOT NULL,
                "update_date" timestamptz NOT NULL,
                "total_amount" numeric(12,2) NOT NULL DEFAULT 0,
                "delivery_code" varchar(100) NULL,
                "customer_name" varchar(120) NULL,
                "table_id" uuid NULL,
                "table_name" varchar(255) NULL,
                "delivery_id" uuid NULL,
                "delivery_name" varchar(255) NULL,
                "delivery_logo" text NULL,
                "items_count" integer NOT NULL DEFAULT 0,
                CONSTRAINT "fk_order_summary_snapshot_order"
                    FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_order_summary_snapshot_branch"
                    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_branch_status_type_created_desc"
            ON "order_summary_snapshots" ("branch_id", "status", "order_type", "create_date" DESC, "order_id" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_branch_created_desc"
            ON "order_summary_snapshots" ("branch_id", "create_date" DESC, "order_id" DESC)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_created_by"
            ON "order_summary_snapshots" ("created_by_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_order_no_trgm"
            ON "order_summary_snapshots" USING gin ("order_no" gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_delivery_code_trgm"
            ON "order_summary_snapshots" USING gin ("delivery_code" gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_customer_name_trgm"
            ON "order_summary_snapshots" USING gin ("customer_name" gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_table_name_trgm"
            ON "order_summary_snapshots" USING gin ("table_name" gin_trgm_ops)
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_order_summary_snapshots_delivery_name_trgm"
            ON "order_summary_snapshots" USING gin ("delivery_name" gin_trgm_ops)
        `);
        await queryRunner.query(`
            INSERT INTO "order_summary_snapshots" (
                "order_id",
                "branch_id",
                "created_by_id",
                "order_no",
                "order_type",
                "status",
                "create_date",
                "update_date",
                "total_amount",
                "delivery_code",
                "customer_name",
                "table_id",
                "table_name",
                "delivery_id",
                "delivery_name",
                "delivery_logo",
                "items_count"
            )
            SELECT
                o.id AS order_id,
                o.branch_id,
                o.created_by_id,
                o.order_no,
                o.order_type,
                o.status,
                o.create_date,
                o.update_date,
                o.total_amount,
                o.delivery_code,
                o.customer_name,
                o.table_id,
                t.table_name,
                o.delivery_id,
                d.delivery_name,
                d.logo,
                COALESCE(items.items_count, 0) AS items_count
            FROM sales_orders o
            LEFT JOIN tables t ON t.id = o.table_id
            LEFT JOIN delivery d ON d.id = o.delivery_id
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(i.quantity), 0)::int AS items_count
                FROM sales_order_item i
                WHERE i.order_id = o.id
                  AND i.status::text NOT IN ('Cancelled', 'cancelled')
            ) items ON true
            ON CONFLICT ("order_id") DO UPDATE SET
                "branch_id" = EXCLUDED."branch_id",
                "created_by_id" = EXCLUDED."created_by_id",
                "order_no" = EXCLUDED."order_no",
                "order_type" = EXCLUDED."order_type",
                "status" = EXCLUDED."status",
                "create_date" = EXCLUDED."create_date",
                "update_date" = EXCLUDED."update_date",
                "total_amount" = EXCLUDED."total_amount",
                "delivery_code" = EXCLUDED."delivery_code",
                "customer_name" = EXCLUDED."customer_name",
                "table_id" = EXCLUDED."table_id",
                "table_name" = EXCLUDED."table_name",
                "delivery_id" = EXCLUDED."delivery_id",
                "delivery_name" = EXCLUDED."delivery_name",
                "delivery_logo" = EXCLUDED."delivery_logo",
                "items_count" = EXCLUDED."items_count"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_delivery_name_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_table_name_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_customer_name_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_delivery_code_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_order_no_trgm"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_created_by"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_branch_created_desc"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_summary_snapshots_branch_status_type_created_desc"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "order_summary_snapshots"`);
    }
}
