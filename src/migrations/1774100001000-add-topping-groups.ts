import { MigrationInterface, QueryRunner } from "typeorm";

export class AddToppingGroups1774100001000 implements MigrationInterface {
    name = "AddToppingGroups1774100001000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "topping_group" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "display_name" character varying(100) NOT NULL,
                "branch_id" uuid,
                "create_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "update_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "is_active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_topping_group_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_topping_group_display_name_branch_id"
            ON "topping_group" ("display_name", "branch_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_topping_group_branch_id"
            ON "topping_group" ("branch_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_topping_group_is_active"
            ON "topping_group" ("is_active")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_topping_group_branch_id'
                ) THEN
                    ALTER TABLE "topping_group"
                    ADD CONSTRAINT "FK_topping_group_branch_id"
                    FOREIGN KEY ("branch_id")
                    REFERENCES "branches"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "product_topping_groups" (
                "product_id" uuid NOT NULL,
                "topping_group_id" uuid NOT NULL,
                CONSTRAINT "PK_product_topping_groups" PRIMARY KEY ("product_id", "topping_group_id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_product_topping_groups_product_id"
            ON "product_topping_groups" ("product_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_product_topping_groups_group_id"
            ON "product_topping_groups" ("topping_group_id")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_topping_groups_product_id'
                ) THEN
                    ALTER TABLE "product_topping_groups"
                    ADD CONSTRAINT "FK_product_topping_groups_product_id"
                    FOREIGN KEY ("product_id")
                    REFERENCES "products"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_topping_groups_group_id'
                ) THEN
                    ALTER TABLE "product_topping_groups"
                    ADD CONSTRAINT "FK_product_topping_groups_group_id"
                    FOREIGN KEY ("topping_group_id")
                    REFERENCES "topping_group"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "topping_group_toppings" (
                "topping_id" uuid NOT NULL,
                "topping_group_id" uuid NOT NULL,
                CONSTRAINT "PK_topping_group_toppings" PRIMARY KEY ("topping_id", "topping_group_id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_topping_group_toppings_topping_id"
            ON "topping_group_toppings" ("topping_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_topping_group_toppings_group_id"
            ON "topping_group_toppings" ("topping_group_id")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_topping_group_toppings_topping_id'
                ) THEN
                    ALTER TABLE "topping_group_toppings"
                    ADD CONSTRAINT "FK_topping_group_toppings_topping_id"
                    FOREIGN KEY ("topping_id")
                    REFERENCES "topping"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_topping_group_toppings_group_id'
                ) THEN
                    ALTER TABLE "topping_group_toppings"
                    ADD CONSTRAINT "FK_topping_group_toppings_group_id"
                    FOREIGN KEY ("topping_group_id")
                    REFERENCES "topping_group"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`DROP TABLE IF EXISTS "product_categories" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "product_categories" (
                "product_id" uuid NOT NULL,
                "category_id" uuid NOT NULL,
                CONSTRAINT "PK_product_categories" PRIMARY KEY ("product_id", "category_id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_product_categories_product_id"
            ON "product_categories" ("product_id")
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_product_categories_category_id"
            ON "product_categories" ("category_id")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_categories_product_id'
                ) THEN
                    ALTER TABLE "product_categories"
                    ADD CONSTRAINT "FK_product_categories_product_id"
                    FOREIGN KEY ("product_id")
                    REFERENCES "products"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_product_categories_category_id'
                ) THEN
                    ALTER TABLE "product_categories"
                    ADD CONSTRAINT "FK_product_categories_category_id"
                    FOREIGN KEY ("category_id")
                    REFERENCES "category"("id")
                    ON DELETE CASCADE
                    ON UPDATE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`DROP TABLE IF EXISTS "topping_group_toppings" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "product_topping_groups" CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS "topping_group" CASCADE`);
    }
}
