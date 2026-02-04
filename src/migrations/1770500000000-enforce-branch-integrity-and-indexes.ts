import { MigrationInterface, QueryRunner } from "typeorm";

export class EnforceBranchIntegrityAndIndexes1770500000000 implements MigrationInterface {
    name = "EnforceBranchIntegrityAndIndexes1770500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Performance: branch-scoped audit log queries
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_audit_logs_branch_created_at" ON "audit_logs" ("branch_id", "created_at")`
        );

        // Backfill branch_id for legacy rows (to avoid invisible data after RLS).
        // - If multiple branches exist, you MUST provide BRANCH_BACKFILL_ID to avoid accidental mis-assignment.
        const countRows = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM "branches"`);
        const branchCount = Number(countRows?.[0]?.count ?? 0);

        const envBackfillBranchId = (process.env.BRANCH_BACKFILL_ID || process.env.DEFAULT_BRANCH_ID || "").trim();
        let backfillBranchId = envBackfillBranchId || "";

        if (!backfillBranchId) {
            if (branchCount === 0) {
                // Auto-create a default branch if none exists
                const result = await queryRunner.query(
                    `INSERT INTO "branches" ("branch_name", "branch_code", "is_active") VALUES ('Main Branch', 'MAIN', true) RETURNING "id"`
                );
                backfillBranchId = result[0].id;
                console.log(`[Migration] Created default branch with ID: ${backfillBranchId}`);
            } else if (branchCount > 1) {
                throw new Error(
                    'Multiple branches exist; set env BRANCH_BACKFILL_ID (uuid) to backfill NULL branch_id rows safely.'
                );
            } else {
                const idRows = await queryRunner.query(`SELECT id FROM "branches" LIMIT 1`);
                backfillBranchId = String(idRows?.[0]?.id ?? "").trim();
            }
        }

        if (!backfillBranchId) {
            throw new Error("Failed to resolve a backfill branch id (BRANCH_BACKFILL_ID/DEFAULT_BRANCH_ID).");
        }

        // Prefer deriving branch_id from parent relations where possible.
        await queryRunner.query(`
            UPDATE "payments" p
            SET "branch_id" = o."branch_id"
            FROM "sales_orders" o
            WHERE p."order_id" = o."id"
              AND p."branch_id" IS NULL
              AND o."branch_id" IS NOT NULL
        `);

        await queryRunner.query(`
            UPDATE "order_queue" q
            SET "branch_id" = o."branch_id"
            FROM "sales_orders" o
            WHERE q."order_id" = o."id"
              AND q."branch_id" IS NULL
              AND o."branch_id" IS NOT NULL
        `);

        // Generic backfill fallback
        const branchTables = [
            "category",
            "products",
            "products_unit",
            "discounts",
            "delivery",
            "payment_method",
            "tables",
            "sales_orders",
            "payments",
            "shifts",
            "shop_profile",
            "shop_payment_account",
            "order_queue",
            "promotions",
            "stock_ingredients_unit",
            "stock_ingredients",
            "stock_orders",
        ];

        for (const table of branchTables) {
            await queryRunner.query(`UPDATE "${table}" SET "branch_id" = $1 WHERE "branch_id" IS NULL`, [
                backfillBranchId,
            ]);
        }

        // Enforce NOT NULL for branch-scoped tables (prevents new "global" rows that RLS would hide).
        for (const table of branchTables) {
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "branch_id" SET NOT NULL`);
        }

        // Composite uniqueness needed for branch-consistent foreign keys.
        const uniqueIndexes: Array<{ name: string; table: string }> = [
            { name: "UQ_category_id_branch", table: "category" },
            { name: "UQ_products_unit_id_branch", table: "products_unit" },
            { name: "UQ_tables_id_branch", table: "tables" },
            { name: "UQ_delivery_id_branch", table: "delivery" },
            { name: "UQ_discounts_id_branch", table: "discounts" },
            { name: "UQ_payment_method_id_branch", table: "payment_method" },
            { name: "UQ_sales_orders_id_branch", table: "sales_orders" },
            { name: "UQ_shifts_id_branch", table: "shifts" },
        ];

        for (const { name, table } of uniqueIndexes) {
            await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "${name}" ON "${table}" ("id", "branch_id")`);
        }

        // Cross-table branch integrity (prevents referencing an entity from another branch)
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_products_category_branch') THEN
                    ALTER TABLE "products"
                    ADD CONSTRAINT "FK_products_category_branch"
                    FOREIGN KEY ("category_id", "branch_id")
                    REFERENCES "category"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_products_unit_branch') THEN
                    ALTER TABLE "products"
                    ADD CONSTRAINT "FK_products_unit_branch"
                    FOREIGN KEY ("unit_id", "branch_id")
                    REFERENCES "products_unit"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_sales_orders_table_branch') THEN
                    ALTER TABLE "sales_orders"
                    ADD CONSTRAINT "FK_sales_orders_table_branch"
                    FOREIGN KEY ("table_id", "branch_id")
                    REFERENCES "tables"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_sales_orders_delivery_branch') THEN
                    ALTER TABLE "sales_orders"
                    ADD CONSTRAINT "FK_sales_orders_delivery_branch"
                    FOREIGN KEY ("delivery_id", "branch_id")
                    REFERENCES "delivery"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_sales_orders_discounts_branch') THEN
                    ALTER TABLE "sales_orders"
                    ADD CONSTRAINT "FK_sales_orders_discounts_branch"
                    FOREIGN KEY ("discount_id", "branch_id")
                    REFERENCES "discounts"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_order_branch') THEN
                    ALTER TABLE "payments"
                    ADD CONSTRAINT "FK_payments_order_branch"
                    FOREIGN KEY ("order_id", "branch_id")
                    REFERENCES "sales_orders"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_payment_method_branch') THEN
                    ALTER TABLE "payments"
                    ADD CONSTRAINT "FK_payments_payment_method_branch"
                    FOREIGN KEY ("payment_method_id", "branch_id")
                    REFERENCES "payment_method"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_shift_branch') THEN
                    ALTER TABLE "payments"
                    ADD CONSTRAINT "FK_payments_shift_branch"
                    FOREIGN KEY ("shift_id", "branch_id")
                    REFERENCES "shifts"("id", "branch_id");
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_order_queue_order_branch') THEN
                    ALTER TABLE "order_queue"
                    ADD CONSTRAINT "FK_order_queue_order_branch"
                    FOREIGN KEY ("order_id", "branch_id")
                    REFERENCES "sales_orders"("id", "branch_id");
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order_queue" DROP CONSTRAINT IF EXISTS "FK_order_queue_order_branch"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_shift_branch"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_payment_method_branch"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "FK_payments_order_branch"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "FK_sales_orders_discounts_branch"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "FK_sales_orders_delivery_branch"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "FK_sales_orders_table_branch"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_unit_branch"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_products_category_branch"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_shifts_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sales_orders_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_payment_method_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_discounts_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_delivery_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tables_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_products_unit_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_category_id_branch"`);

        const branchTables = [
            "category",
            "products",
            "products_unit",
            "discounts",
            "delivery",
            "payment_method",
            "tables",
            "sales_orders",
            "payments",
            "shifts",
            "shop_profile",
            "shop_payment_account",
            "order_queue",
            "promotions",
            "stock_ingredients_unit",
            "stock_ingredients",
            "stock_orders",
        ];

        for (const table of branchTables) {
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "branch_id" DROP NOT NULL`);
        }

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_branch_created_at"`);
    }
}
