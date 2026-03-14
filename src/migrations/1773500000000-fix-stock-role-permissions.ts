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

const STOCK_MENU_KEYS = [
    "menu.main.stock",
    "menu.main.orders",
    "menu.module.stock",
    "menu.stock.home",
    "menu.stock.buying",
    "menu.stock.orders",
    "menu.stock.history",
    "menu.stock.ingredients",
    "menu.stock.ingredientsUnit",
] as const;

const STOCK_PAGE_KEYS = [
    "stock.orders.page",
    "stock.ingredients.page",
    "stock.ingredients_unit.page",
] as const;

const ACTION_KEYS: readonly ActionKey[] = ["access", "view", "create", "update", "delete"];

function buildSeeds(): PermissionSeed[] {
    const seeds: PermissionSeed[] = [];

    for (const resourceKey of STOCK_MENU_KEYS) {
        for (const actionKey of ACTION_KEYS) {
            seeds.push({
                resourceKey,
                actionKey,
                roleName: "Admin",
                effect: "allow",
                scope: "all",
            });

            seeds.push({
                resourceKey,
                actionKey,
                roleName: "Manager",
                effect: actionKey === "access" || actionKey === "view" ? "allow" : "deny",
                scope: actionKey === "access" || actionKey === "view" ? "branch" : "none",
            });

            seeds.push({
                resourceKey,
                actionKey,
                roleName: "Employee",
                effect: actionKey === "access" || actionKey === "view" ? "allow" : "deny",
                scope: actionKey === "access" || actionKey === "view" ? "branch" : "none",
            });
        }
    }

    for (const actionKey of ACTION_KEYS) {
        seeds.push({
            resourceKey: "stock.orders.page",
            actionKey,
            roleName: "Admin",
            effect: "allow",
            scope: "all",
        });
        seeds.push({
            resourceKey: "stock.orders.page",
            actionKey,
            roleName: "Manager",
            effect: actionKey === "delete" ? "deny" : "allow",
            scope: actionKey === "delete" ? "none" : "branch",
        });
        seeds.push({
            resourceKey: "stock.orders.page",
            actionKey,
            roleName: "Employee",
            effect: actionKey === "delete" ? "deny" : "allow",
            scope: actionKey === "delete" ? "none" : "branch",
        });
    }

    for (const resourceKey of ["stock.ingredients.page", "stock.ingredients_unit.page"] as const) {
        for (const actionKey of ACTION_KEYS) {
            seeds.push({
                resourceKey,
                actionKey,
                roleName: "Admin",
                effect: "allow",
                scope: "all",
            });
            seeds.push({
                resourceKey,
                actionKey,
                roleName: "Manager",
                effect: actionKey === "delete" ? "deny" : "allow",
                scope: actionKey === "delete" ? "none" : "branch",
            });
            seeds.push({
                resourceKey,
                actionKey,
                roleName: "Employee",
                effect: actionKey === "access" || actionKey === "view" ? "allow" : "deny",
                scope: actionKey === "access" || actionKey === "view" ? "branch" : "none",
            });
        }
    }

    return seeds;
}

export class FixStockRolePermissions1773500000000 implements MigrationInterface {
    name = "FixStockRolePermissions1773500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        const seeds = buildSeeds();

        for (const seed of seeds) {
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

    public async down(): Promise<void> {
        // No-op. These rows are baseline permissions and should not be rolled back automatically.
    }
}
