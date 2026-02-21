import { MigrationInterface, QueryRunner } from "typeorm";

type RoleName = "Admin" | "Manager" | "Employee";
type ActionKey = "access" | "view" | "create" | "update" | "delete";
type Effect = "allow" | "deny";

type MenuRolePolicy = {
    access: Effect;
    view: Effect;
    create: Effect;
    update: Effect;
    delete: Effect;
    scope: "none" | "own" | "branch" | "all";
};

type MenuResourceSeed = {
    resourceKey: string;
    resourceName: string;
    routePattern: string;
    sortOrder: number;
    policies: Record<RoleName, MenuRolePolicy>;
};

const VERSION_KEY = "2026-02-13-phase9-menu-visibility";
const ACTION_KEYS: ActionKey[] = ["access", "view", "create", "update", "delete"];

function menuPolicy(
    accessByRole: Record<RoleName, boolean>,
    scopeByRole: Record<RoleName, "none" | "branch" | "all">
): Record<RoleName, MenuRolePolicy> {
    return {
        Admin: {
            access: accessByRole.Admin ? "allow" : "deny",
            view: accessByRole.Admin ? "allow" : "deny",
            create: "deny",
            update: "deny",
            delete: "deny",
            scope: scopeByRole.Admin,
        },
        Manager: {
            access: accessByRole.Manager ? "allow" : "deny",
            view: accessByRole.Manager ? "allow" : "deny",
            create: "deny",
            update: "deny",
            delete: "deny",
            scope: scopeByRole.Manager,
        },
        Employee: {
            access: accessByRole.Employee ? "allow" : "deny",
            view: accessByRole.Employee ? "allow" : "deny",
            create: "deny",
            update: "deny",
            delete: "deny",
            scope: scopeByRole.Employee,
        },
    };
}

const MENU_RESOURCE_SEEDS: MenuResourceSeed[] = [
    // Main navigation
    {
        resourceKey: "menu.main.home",
        resourceName: "Main Menu - Home",
        routePattern: "/",
        sortOrder: 2000,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.main.stock",
        resourceName: "Main Menu - Stock",
        routePattern: "/stock",
        sortOrder: 2001,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.main.orders",
        resourceName: "Main Menu - Orders",
        routePattern: "/stock/items",
        sortOrder: 2002,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.main.users",
        resourceName: "Main Menu - Users",
        routePattern: "/users",
        sortOrder: 2003,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },

    // Landing modules
    {
        resourceKey: "menu.module.pos",
        resourceName: "Landing Module - POS",
        routePattern: "/pos",
        sortOrder: 2010,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.module.stock",
        resourceName: "Landing Module - Stock",
        routePattern: "/stock",
        sortOrder: 2011,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.module.users",
        resourceName: "Landing Module - Users",
        routePattern: "/users",
        sortOrder: 2012,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.module.branch",
        resourceName: "Landing Module - Branch",
        routePattern: "/branch",
        sortOrder: 2013,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.module.audit",
        resourceName: "Landing Module - Audit",
        routePattern: "/audit",
        sortOrder: 2014,
        policies: menuPolicy(
            { Admin: true, Manager: false, Employee: false },
            { Admin: "all", Manager: "none", Employee: "none" }
        ),
    },

    // POS menu
    {
        resourceKey: "menu.pos.home",
        resourceName: "POS Menu - Home",
        routePattern: "/",
        sortOrder: 2020,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.sell",
        resourceName: "POS Menu - Sell",
        routePattern: "/pos",
        sortOrder: 2021,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.orders",
        resourceName: "POS Menu - Orders",
        routePattern: "/pos/orders",
        sortOrder: 2022,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.kitchen",
        resourceName: "POS Menu - Kitchen",
        routePattern: "/pos/kitchen",
        sortOrder: 2023,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.shift",
        resourceName: "POS Menu - Shift",
        routePattern: "/pos/shift",
        sortOrder: 2024,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.shiftHistory",
        resourceName: "POS Menu - Shift History",
        routePattern: "/pos/shiftHistory",
        sortOrder: 2025,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.dashboard",
        resourceName: "POS Menu - Dashboard",
        routePattern: "/pos/dashboard",
        sortOrder: 2026,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.pos.tables",
        resourceName: "POS Menu - Tables",
        routePattern: "/pos/tables",
        sortOrder: 2027,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.delivery",
        resourceName: "POS Menu - Delivery",
        routePattern: "/pos/delivery",
        sortOrder: 2028,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.category",
        resourceName: "POS Menu - Category",
        routePattern: "/pos/category",
        sortOrder: 2029,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.products",
        resourceName: "POS Menu - Products",
        routePattern: "/pos/products",
        sortOrder: 2030,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.productsUnit",
        resourceName: "POS Menu - Product Units",
        routePattern: "/pos/productsUnit",
        sortOrder: 2031,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.discounts",
        resourceName: "POS Menu - Discounts",
        routePattern: "/pos/discounts",
        sortOrder: 2032,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.payment",
        resourceName: "POS Menu - Payment",
        routePattern: "/pos/paymentMethod",
        sortOrder: 2033,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.pos.settings",
        resourceName: "POS Menu - Settings",
        routePattern: "/pos/settings",
        sortOrder: 2034,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },

    // Stock menu
    {
        resourceKey: "menu.stock.home",
        resourceName: "Stock Menu - Home",
        routePattern: "/",
        sortOrder: 2040,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.stock.buying",
        resourceName: "Stock Menu - Buying",
        routePattern: "/stock",
        sortOrder: 2041,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.stock.orders",
        resourceName: "Stock Menu - Orders",
        routePattern: "/stock/items",
        sortOrder: 2042,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.stock.history",
        resourceName: "Stock Menu - History",
        routePattern: "/stock/history",
        sortOrder: 2043,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.stock.ingredients",
        resourceName: "Stock Menu - Ingredients",
        routePattern: "/stock/ingredients",
        sortOrder: 2044,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },
    {
        resourceKey: "menu.stock.ingredientsUnit",
        resourceName: "Stock Menu - Ingredient Units",
        routePattern: "/stock/ingredientsUnit",
        sortOrder: 2045,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: false },
            { Admin: "all", Manager: "branch", Employee: "none" }
        ),
    },

    // Section simple menu buttons
    {
        resourceKey: "menu.users.home",
        resourceName: "Users Menu - Home",
        routePattern: "/",
        sortOrder: 2050,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
    {
        resourceKey: "menu.branch.home",
        resourceName: "Branch Menu - Home",
        routePattern: "/",
        sortOrder: 2051,
        policies: menuPolicy(
            { Admin: true, Manager: true, Employee: true },
            { Admin: "all", Manager: "branch", Employee: "branch" }
        ),
    },
];

export class AddMenuPermissionsPhase91772000000000 implements MigrationInterface {
    name = "AddMenuPermissionsPhase91772000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `
                INSERT INTO "permission_policy_versions" ("version_key", "description")
                VALUES ($1, $2)
                ON CONFLICT ("version_key")
                DO UPDATE SET "description" = EXCLUDED."description"
            `,
            [VERSION_KEY, "Phase 9: menu visibility permission resources and defaults"]
        );

        for (const resource of MENU_RESOURCE_SEEDS) {
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
                    VALUES ($1, $2, $3, 'menu', $4, true)
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

        for (const resource of MENU_RESOURCE_SEEDS) {
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
        const resourceKeys = MENU_RESOURCE_SEEDS.map((resource) => resource.resourceKey);

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
