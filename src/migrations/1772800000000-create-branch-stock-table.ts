import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBranchStockTable1772800000000 implements MigrationInterface {
    name = "CreateBranchStockTable1772800000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "branch_stock" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "branch_id" uuid NOT NULL,
                "ingredient_id" uuid NOT NULL,
                "quantity" numeric(12,2) NOT NULL DEFAULT 0,
                "last_updated" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Unique per ingredient per branch (required for upsert).
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_branch_stock_branch_ingredient"
            ON "branch_stock" ("branch_id", "ingredient_id")
        `);

        // Basic query indexes.
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_branch_stock_branch_id"
            ON "branch_stock" ("branch_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_branch_stock_ingredient_id"
            ON "branch_stock" ("ingredient_id")
        `);

        // FK constraints (idempotent with IF NOT EXISTS via exception-safe block).
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_branch_stock_branch'
                ) THEN
                    ALTER TABLE "branch_stock"
                    ADD CONSTRAINT "FK_branch_stock_branch"
                    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_branch_stock_ingredient'
                ) THEN
                    ALTER TABLE "branch_stock"
                    ADD CONSTRAINT "FK_branch_stock_ingredient"
                    FOREIGN KEY ("ingredient_id") REFERENCES "stock_ingredients"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Dropping the table also drops indexes/constraints.
        await queryRunner.query(`DROP TABLE IF EXISTS "branch_stock"`);
    }
}

