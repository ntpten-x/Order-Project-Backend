import { MigrationInterface, QueryRunner } from "typeorm";

type RoleName = "Admin" | "Manager" | "Employee";
type ActionKey = "access" | "view" | "create" | "update" | "delete";
type PermissionSeed = {
    resourceKey: string;
    actionKey: ActionKey;
    roleName: RoleName;
    effect: "allow" | "deny";
    scope: "none" | "branch" | "all";
};

const STOCK_CATEGORY_RESOURCES = [
    {
        resourceKey: "menu.stock.category",
        resourceName: "Stock Menu - Categories",
        routePattern: "/stock/category",
        resourceType: "menu",
        sortOrder: 2046,
    },
    {
        resourceKey: "stock.category.page",
        resourceName: "Stock Categories",
        routePattern: "/stock/category",
        resourceType: "page",
        sortOrder: 43,
    },
] as const;

function buildPermissionSeeds(): PermissionSeed[] {
    const actionKeys: ActionKey[] = ["access", "view", "create", "update", "delete"];
    const seeds: PermissionSeed[] = [];

    for (const actionKey of actionKeys) {
        seeds.push({
            resourceKey: "menu.stock.category",
            actionKey,
            roleName: "Admin",
            effect: "allow",
            scope: "all",
        });
        seeds.push({
            resourceKey: "menu.stock.category",
            actionKey,
            roleName: "Manager",
            effect: actionKey === "access" || actionKey === "view" ? "allow" : "deny",
            scope: actionKey === "access" || actionKey === "view" ? "branch" : "none",
        });
        seeds.push({
            resourceKey: "menu.stock.category",
            actionKey,
            roleName: "Employee",
            effect: actionKey === "access" || actionKey === "view" ? "allow" : "deny",
            scope: actionKey === "access" || actionKey === "view" ? "branch" : "none",
        });

        seeds.push({
            resourceKey: "stock.category.page",
            actionKey,
            roleName: "Admin",
            effect: "allow",
            scope: "all",
        });
        seeds.push({
            resourceKey: "stock.category.page",
            actionKey,
            roleName: "Manager",
            effect: actionKey === "delete" ? "deny" : "allow",
            scope: actionKey === "delete" ? "none" : "branch",
        });
        seeds.push({
            resourceKey: "stock.category.page",
            actionKey,
            roleName: "Employee",
            effect: actionKey === "access" || actionKey === "view" ? "allow" : "deny",
            scope: actionKey === "access" || actionKey === "view" ? "branch" : "none",
        });
    }

    return seeds;
}

export class AddStockCategories1774200000000 implements MigrationInterface {
    name = "AddStockCategories1774200000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "stock_categories" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "display_name" character varying(100) NOT NULL,
                "branch_id" uuid NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "create_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "update_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_categories_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_categories_branch'
                ) THEN
                    ALTER TABLE "stock_categories"
                    ADD CONSTRAINT "FK_stock_categories_branch"
                    FOREIGN KEY ("branch_id")
                    REFERENCES "branches"("id")
                    ON DELETE RESTRICT
                    ON UPDATE CASCADE;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_categories_display_name_branch"
            ON "stock_categories" ("display_name", "branch_id")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_categories_id_branch"
            ON "stock_categories" ("id", "branch_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_categories_branch_id"
            ON "stock_categories" ("branch_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_categories_branch_active_create"
            ON "stock_categories" ("branch_id", "is_active", "create_date" DESC)
        `);

        await queryRunner.query(`
            ALTER TABLE "stock_ingredients"
            ADD COLUMN IF NOT EXISTS "category_id" uuid
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_ingredients_category_id"
            ON "stock_ingredients" ("category_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_stock_ingredients_branch_category_create"
            ON "stock_ingredients" ("branch_id", "category_id", "create_date" DESC)
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_stock_ingredients_category_branch'
                ) THEN
                    ALTER TABLE "stock_ingredients"
                    ADD CONSTRAINT "FK_stock_ingredients_category_branch"
                    FOREIGN KEY ("category_id", "branch_id")
                    REFERENCES "stock_categories"("id", "branch_id")
                    ON DELETE SET NULL
                    ON UPDATE CASCADE;
                END IF;
            END $$;
        `);

        const branchIsolationSql = `("branch_id" = app.current_branch_id()) OR (app.is_admin() AND app.current_branch_id() IS NULL)`;
        await queryRunner.query(`ALTER TABLE "stock_categories" ENABLE ROW LEVEL SECURITY`);
        await queryRunner.query(`ALTER TABLE "stock_categories" FORCE ROW LEVEL SECURITY`);
        await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "stock_categories"`);
        await queryRunner.query(`
            CREATE POLICY "branch_isolation" ON "stock_categories"
            USING (${branchIsolationSql})
            WITH CHECK (${branchIsolationSql})
        `);

        for (const resource of STOCK_CATEGORY_RESOURCES) {
            await queryRunner.query(
                `
                    INSERT INTO permission_resources
                        (resource_key, resource_name, route_pattern, resource_type, sort_order, is_active)
                    VALUES
                        ($1, $2, $3, $4, $5, true)
                    ON CONFLICT (resource_key)
                    DO UPDATE SET
                        resource_name = EXCLUDED.resource_name,
                        route_pattern = EXCLUDED.route_pattern,
                        resource_type = EXCLUDED.resource_type,
                        sort_order = EXCLUDED.sort_order,
                        is_active = true,
                        updated_at = now()
                `,
                [
                    resource.resourceKey,
                    resource.resourceName,
                    resource.routePattern,
                    resource.resourceType,
                    resource.sortOrder,
                ]
            );
        }

        const permissionSeeds = buildPermissionSeeds();
        for (const seed of permissionSeeds) {
            await queryRunner.query(
                `
                    INSERT INTO role_permissions (role_id, resource_id, action_id, effect, scope)
                    SELECT r.id, pr.id, pa.id, $4, $5
                    FROM roles r
                    INNER JOIN permission_resources pr ON pr.resource_key = $1
                    INNER JOIN permission_actions pa ON pa.action_key = $2
                    WHERE lower(r.roles_name) = lower($3)
                    ON CONFLICT (role_id, resource_id, action_id)
                    DO UPDATE SET
                        effect = EXCLUDED.effect,
                        scope = EXCLUDED.scope
                `,
                [seed.resourceKey, seed.actionKey, seed.roleName, seed.effect, seed.scope]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', true)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', true)`);

        await queryRunner.query(`DROP POLICY IF EXISTS "branch_isolation" ON "stock_categories"`);
        await queryRunner.query(`ALTER TABLE "stock_categories" DISABLE ROW LEVEL SECURITY`);

        await queryRunner.query(`
            DELETE FROM role_permissions
            WHERE resource_id IN (
                SELECT id
                FROM permission_resources
                WHERE resource_key IN ('menu.stock.category', 'stock.category.page')
            )
        `);
        await queryRunner.query(`
            DELETE FROM permission_resources
            WHERE resource_key IN ('menu.stock.category', 'stock.category.page')
        `);

        await queryRunner.query(`ALTER TABLE "stock_ingredients" DROP CONSTRAINT IF EXISTS "FK_stock_ingredients_category_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_ingredients_branch_category_create"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_ingredients_category_id"`);
        await queryRunner.query(`ALTER TABLE "stock_ingredients" DROP COLUMN IF EXISTS "category_id"`);

        await queryRunner.query(`ALTER TABLE "stock_categories" DROP CONSTRAINT IF EXISTS "FK_stock_categories_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_categories_branch_active_create"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_categories_branch_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_categories_id_branch"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_stock_categories_display_name_branch"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "stock_categories"`);
    }
}
