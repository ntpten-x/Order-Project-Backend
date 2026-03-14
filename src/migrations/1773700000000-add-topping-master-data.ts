import { MigrationInterface, QueryRunner } from "typeorm";

type RoleName = "Admin" | "Manager" | "Employee";
type ActionKey = "access" | "view" | "create" | "update" | "delete";

const PAGE_RESOURCE_KEY = "topping.page";
const ACTION_POLICIES: Array<{
    role: RoleName;
    action: ActionKey;
    effect: "allow" | "deny";
    scope: "none" | "branch" | "all";
}> = [
    { role: "Admin", action: "access", effect: "allow", scope: "all" },
    { role: "Admin", action: "view", effect: "allow", scope: "all" },
    { role: "Admin", action: "create", effect: "allow", scope: "all" },
    { role: "Admin", action: "update", effect: "allow", scope: "all" },
    { role: "Admin", action: "delete", effect: "allow", scope: "all" },
    { role: "Manager", action: "access", effect: "allow", scope: "branch" },
    { role: "Manager", action: "view", effect: "allow", scope: "branch" },
    { role: "Manager", action: "create", effect: "allow", scope: "branch" },
    { role: "Manager", action: "update", effect: "allow", scope: "branch" },
    { role: "Manager", action: "delete", effect: "deny", scope: "none" },
    { role: "Employee", action: "access", effect: "allow", scope: "branch" },
    { role: "Employee", action: "view", effect: "allow", scope: "branch" },
    { role: "Employee", action: "create", effect: "deny", scope: "none" },
    { role: "Employee", action: "update", effect: "deny", scope: "none" },
    { role: "Employee", action: "delete", effect: "deny", scope: "none" },
];

export class AddToppingMasterData1773700000000 implements MigrationInterface {
    name = "AddToppingMasterData1773700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "topping" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "display_name" character varying(100) NOT NULL,
                "branch_id" uuid NOT NULL,
                "create_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "update_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "is_active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "PK_topping_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_topping_display_name_branch_id" UNIQUE ("display_name", "branch_id"),
                CONSTRAINT "FK_topping_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_topping_branch_id" ON "topping" ("branch_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_topping_is_active" ON "topping" ("is_active")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_topping_branch_active_created" ON "topping" ("branch_id", "is_active", "create_date" DESC)`);

        await queryRunner.query(
            `
                INSERT INTO "permission_resources" (
                    "resource_key",
                    "resource_name",
                    "route_pattern",
                    "resource_type",
                    "sort_order",
                    "is_active"
                )
                VALUES ($1, $2, $3, 'page', $4, true)
                ON CONFLICT ("resource_key")
                DO UPDATE SET
                    "resource_name" = EXCLUDED."resource_name",
                    "route_pattern" = EXCLUDED."route_pattern",
                    "resource_type" = EXCLUDED."resource_type",
                    "sort_order" = EXCLUDED."sort_order",
                    "is_active" = true,
                    "updated_at" = now()
            `,
            [PAGE_RESOURCE_KEY, "Toppings", "/pos/topping", 24]
        );

        for (const policy of ACTION_POLICIES) {
            await queryRunner.query(
                `
                    WITH target AS (
                        SELECT
                            r.id AS role_id,
                            pr.id AS resource_id,
                            pa.id AS action_id
                        FROM "roles" r
                        INNER JOIN "permission_resources" pr ON pr.resource_key = $3
                        INNER JOIN "permission_actions" pa ON pa.action_key = $4
                        WHERE lower(r.roles_name) = lower($5)
                        LIMIT 1
                    )
                    INSERT INTO "role_permissions" (
                        "role_id",
                        "resource_id",
                        "action_id",
                        "effect",
                        "scope"
                    )
                    SELECT
                        t.role_id,
                        t.resource_id,
                        t.action_id,
                        $1::varchar,
                        $2::varchar
                    FROM target t
                    ON CONFLICT ("role_id", "resource_id", "action_id")
                    DO UPDATE SET
                        "effect" = EXCLUDED."effect",
                        "scope" = EXCLUDED."scope",
                        "updated_at" = now()
                `,
                [policy.effect, policy.scope, PAGE_RESOURCE_KEY, policy.action, policy.role]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
                DELETE FROM "role_permissions"
                WHERE "resource_id" IN (
                    SELECT "id"
                    FROM "permission_resources"
                    WHERE "resource_key" = $1
                )
            `,
            [PAGE_RESOURCE_KEY]
        );

        await queryRunner.query(`DELETE FROM "permission_resources" WHERE "resource_key" = $1`, [PAGE_RESOURCE_KEY]);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_topping_branch_active_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_topping_is_active"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_topping_branch_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "topping"`);
    }
}
