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

const VERSION_KEY = "2026-02-12-phase5-governance";

const RESOURCE_SEEDS: ResourceSeed[] = [
    {
        resourceKey: "category.page",
        resourceName: "Category Management",
        routePattern: "/pos/category",
        sortOrder: 70,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "delivery.page",
        resourceName: "Delivery Management",
        routePattern: "/pos/delivery",
        sortOrder: 80,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "discounts.page",
        resourceName: "Discount Management",
        routePattern: "/pos/discounts",
        sortOrder: 90,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "payment_method.page",
        resourceName: "Payment Method Management",
        routePattern: "/pos/paymentMethod",
        sortOrder: 100,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "tables.page",
        resourceName: "Table Management",
        routePattern: "/pos/tables",
        sortOrder: 110,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "deny", update: "allow", delete: "deny" },
        },
    },
    {
        resourceKey: "payments.page",
        resourceName: "Payments",
        routePattern: "/pos/payments",
        sortOrder: 120,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
        },
    },
    {
        resourceKey: "queue.page",
        resourceName: "Order Queue",
        routePattern: "/pos/queue",
        sortOrder: 130,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
        },
    },
    {
        resourceKey: "payment_accounts.page",
        resourceName: "Payment Accounts",
        routePattern: "/pos/settings/payment-accounts",
        sortOrder: 140,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "stock.ingredients.page",
        resourceName: "Stock Ingredients",
        routePattern: "/stock/ingredients",
        sortOrder: 150,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "stock.ingredients_unit.page",
        resourceName: "Stock Ingredients Unit",
        routePattern: "/stock/ingredientsUnit",
        sortOrder: 160,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
        },
    },
    {
        resourceKey: "stock.orders.page",
        resourceName: "Stock Orders",
        routePattern: "/stock",
        sortOrder: 170,
        policies: {
            Admin: { scope: "all", access: "allow", view: "allow", create: "allow", update: "allow", delete: "allow" },
            Manager: { scope: "branch", access: "allow", view: "allow", create: "allow", update: "allow", delete: "deny" },
            Employee: { scope: "branch", access: "deny", view: "deny", create: "deny", update: "deny", delete: "deny" },
        },
    },
];

const ACTION_KEYS: ActionKey[] = ["access", "view", "create", "update", "delete"];

export class AddPermissionGovernancePhase51771600000000 implements MigrationInterface {
    name = "AddPermissionGovernancePhase51771600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "permission_policy_versions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "version_key" character varying(80) NOT NULL,
                "description" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_permission_policy_versions_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_permission_policy_versions_version_key" UNIQUE ("version_key")
            )
        `);

        await queryRunner.query(
            `
                INSERT INTO "permission_policy_versions" ("version_key", "description")
                VALUES ($1, $2)
                ON CONFLICT ("version_key")
                DO UPDATE SET
                    "description" = EXCLUDED."description"
            `,
            [VERSION_KEY, "Phase 5: governance baseline, expanded resources, backend permission hard-guard"]
        );

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
        }

        for (const resource of RESOURCE_SEEDS) {
            for (const roleName of Object.keys(resource.policies) as RoleName[]) {
                const policy = resource.policies[roleName];

                for (const actionKey of ACTION_KEYS) {
                    const effect = policy[actionKey];
                    const scope = effect === "allow" ? policy.scope : "none";

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

        await queryRunner.query(
            `
                DELETE FROM "permission_policy_versions"
                WHERE "version_key" = $1
            `,
            [VERSION_KEY]
        );
    }
}
