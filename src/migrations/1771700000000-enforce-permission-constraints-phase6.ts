import { MigrationInterface, QueryRunner } from "typeorm";

type RoleName = "Admin" | "Manager" | "Employee";
type ActionKey = "access" | "view" | "create" | "update" | "delete";
type Effect = "allow" | "deny";
type Scope = "none" | "own" | "branch" | "all";

type RolePolicy = {
    scope: Exclude<Scope, "none">;
    access: Effect;
    view: Effect;
    create: Effect;
    update: Effect;
    delete: Effect;
};

type ResourceSeed = {
    resourceKey: string;
    resourceName: string;
    routePattern: string;
    sortOrder: number;
    policies: Record<RoleName, RolePolicy>;
};

const ACTION_KEYS: ActionKey[] = ["access", "view", "create", "update", "delete"];

const RESOURCE_SEEDS: ResourceSeed[] = [
    {
        resourceKey: "branches.page",
        resourceName: "Branch Management",
        routePattern: "/branch",
        sortOrder: 180,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "deny", delete: "deny" },
            Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "permissions.page",
        resourceName: "Permissions Management",
        routePattern: "/users/permissions",
        sortOrder: 190,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
            Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "shop_profile.page",
        resourceName: "Shop Profile",
        routePattern: "/pos/settings",
        sortOrder: 200,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "shifts.page",
        resourceName: "Shift Management",
        routePattern: "/pos/shift",
        sortOrder: 210,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
        },
    },
];

export class EnforcePermissionConstraintsPhase61771700000000 implements MigrationInterface {
    name = "EnforcePermissionConstraintsPhase61771700000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Cleanup duplicates before creating/repairing uniqueness.
        await queryRunner.query(`
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY role_id, resource_id, action_id
                        ORDER BY updated_at DESC, created_at DESC, id DESC
                    ) AS rn
                FROM role_permissions
            )
            DELETE FROM role_permissions rp
            USING ranked r
            WHERE rp.id = r.id
              AND r.rn > 1
        `);

        await queryRunner.query(`
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY user_id, resource_id, action_id
                        ORDER BY updated_at DESC, created_at DESC, id DESC
                    ) AS rn
                FROM user_permissions
            )
            DELETE FROM user_permissions up
            USING ranked r
            WHERE up.id = r.id
              AND r.rn > 1
        `);

        // Enforce uniqueness so ON CONFLICT and data integrity are reliable.
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_role_permissions_role_resource_action"
            ON "role_permissions" ("role_id", "resource_id", "action_id")
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_permissions_user_resource_action"
            ON "user_permissions" ("user_id", "resource_id", "action_id")
        `);

        // Seed resources required by routes migrated from authorizeRole -> authorizePermission.
        for (const resource of RESOURCE_SEEDS) {
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
                [resource.resourceKey, resource.resourceName, resource.routePattern, resource.sortOrder]
            );

            for (const roleName of Object.keys(resource.policies) as RoleName[]) {
                const policy = resource.policies[roleName];

                for (const actionKey of ACTION_KEYS) {
                    const effect = policy[actionKey];
                    const scope = effect === "allow" ? policy.scope : "none";

                    await queryRunner.query(
                        `
                            INSERT INTO "role_permissions" (
                                "role_id",
                                "resource_id",
                                "action_id",
                                "effect",
                                "scope"
                            )
                            SELECT
                                r.id,
                                pr.id,
                                pa.id,
                                $1::varchar,
                                $2::varchar
                            FROM "roles" r
                            INNER JOIN "permission_resources" pr ON pr.resource_key = $3
                            INNER JOIN "permission_actions" pa ON pa.action_key = $4
                            WHERE lower(r.roles_name) = lower($5)
                            ON CONFLICT ("role_id", "resource_id", "action_id")
                            DO UPDATE SET
                                "effect" = EXCLUDED."effect",
                                "scope" = EXCLUDED."scope",
                                "updated_at" = now()
                        `,
                        [effect, scope, resource.resourceKey, actionKey, roleName]
                    );
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const resourceKeys = RESOURCE_SEEDS.map((resource) => resource.resourceKey);

        await queryRunner.query(
            `
                DELETE FROM "role_permissions"
                WHERE "resource_id" IN (
                    SELECT "id"
                    FROM "permission_resources"
                    WHERE "resource_key" = ANY($1)
                )
            `,
            [resourceKeys]
        );

        await queryRunner.query(
            `
                DELETE FROM "permission_resources"
                WHERE "resource_key" = ANY($1)
            `,
            [resourceKeys]
        );

        // Keep unique indexes in down migration to preserve repaired integrity.
    }
}
