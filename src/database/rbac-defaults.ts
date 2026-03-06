import bcrypt from "bcrypt";
import { DataSource, QueryRunner } from "typeorm";

type RoleName = "Admin" | "Manager" | "Employee";
type ResourceType = "page" | "api" | "menu" | "feature";
type ActionKey = "access" | "view" | "create" | "update" | "delete";
type Effect = "allow" | "deny";
type Scope = "none" | "own" | "branch" | "all";

type PermissionResourceRow = {
    id: string;
    resource_key: string;
    resource_type: ResourceType;
};

type PermissionActionRow = {
    id: string;
    action_key: ActionKey;
};

type RoleRow = {
    id: string;
    roles_name: RoleName;
};

type PermissionPolicy = {
    effect: Effect;
    scope: Scope;
};

const CORE_ROLES: Array<{ roleName: RoleName; displayName: string }> = [
    { roleName: "Admin", displayName: "Administrator" },
    { roleName: "Manager", displayName: "Manager" },
    { roleName: "Employee", displayName: "Employee" },
];

const ACTION_KEYS: ActionKey[] = ["access", "view", "create", "update", "delete"];

const CORE_PERMISSION_RESOURCES: Array<{
    resourceKey: string;
    resourceName: string;
    routePattern: string | null;
    resourceType: ResourceType;
    sortOrder: number;
}> = [
    { resourceKey: "menu.main.home", resourceName: "Main Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2000 },
    { resourceKey: "menu.main.stock", resourceName: "Main Menu - Stock", routePattern: "/stock", resourceType: "menu", sortOrder: 2001 },
    { resourceKey: "menu.main.orders", resourceName: "Main Menu - Orders", routePattern: "/stock/items", resourceType: "menu", sortOrder: 2002 },
    { resourceKey: "menu.main.users", resourceName: "Main Menu - Users", routePattern: "/users", resourceType: "menu", sortOrder: 2003 },
    { resourceKey: "menu.module.pos", resourceName: "Landing Module - POS", routePattern: "/pos", resourceType: "menu", sortOrder: 2010 },
    { resourceKey: "menu.module.stock", resourceName: "Landing Module - Stock", routePattern: "/stock", resourceType: "menu", sortOrder: 2011 },
    { resourceKey: "menu.module.users", resourceName: "Landing Module - Users", routePattern: "/users", resourceType: "menu", sortOrder: 2012 },
    { resourceKey: "menu.module.branch", resourceName: "Landing Module - Branch", routePattern: "/branch", resourceType: "menu", sortOrder: 2013 },
    { resourceKey: "menu.module.audit", resourceName: "Landing Module - Audit", routePattern: "/audit", resourceType: "menu", sortOrder: 2014 },
    { resourceKey: "menu.pos.home", resourceName: "POS Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2020 },
    { resourceKey: "menu.pos.sell", resourceName: "POS Menu - Sell", routePattern: "/pos", resourceType: "menu", sortOrder: 2021 },
    { resourceKey: "menu.pos.orders", resourceName: "POS Menu - Orders", routePattern: "/pos/orders", resourceType: "menu", sortOrder: 2022 },
    { resourceKey: "menu.pos.kitchen", resourceName: "POS Menu - Kitchen", routePattern: "/pos/kitchen", resourceType: "menu", sortOrder: 2023 },
    { resourceKey: "menu.pos.shift", resourceName: "POS Menu - Shift", routePattern: "/pos/shift", resourceType: "menu", sortOrder: 2024 },
    { resourceKey: "menu.pos.shiftHistory", resourceName: "POS Menu - Shift History", routePattern: "/pos/shiftHistory", resourceType: "menu", sortOrder: 2025 },
    { resourceKey: "menu.pos.dashboard", resourceName: "POS Menu - Dashboard", routePattern: "/pos/dashboard", resourceType: "menu", sortOrder: 2026 },
    { resourceKey: "menu.pos.tables", resourceName: "POS Menu - Tables", routePattern: "/pos/tables", resourceType: "menu", sortOrder: 2027 },
    { resourceKey: "menu.pos.delivery", resourceName: "POS Menu - Delivery", routePattern: "/pos/delivery", resourceType: "menu", sortOrder: 2028 },
    { resourceKey: "menu.pos.category", resourceName: "POS Menu - Category", routePattern: "/pos/category", resourceType: "menu", sortOrder: 2029 },
    { resourceKey: "menu.pos.products", resourceName: "POS Menu - Products", routePattern: "/pos/products", resourceType: "menu", sortOrder: 2030 },
    { resourceKey: "menu.pos.productsUnit", resourceName: "POS Menu - Product Units", routePattern: "/pos/productsUnit", resourceType: "menu", sortOrder: 2031 },
    { resourceKey: "menu.pos.discounts", resourceName: "POS Menu - Discounts", routePattern: "/pos/discounts", resourceType: "menu", sortOrder: 2032 },
    { resourceKey: "menu.pos.payment", resourceName: "POS Menu - Payment", routePattern: "/pos/paymentMethod", resourceType: "menu", sortOrder: 2033 },
    { resourceKey: "menu.pos.settings", resourceName: "POS Menu - Settings", routePattern: "/pos/settings", resourceType: "menu", sortOrder: 2034 },
    { resourceKey: "menu.stock.home", resourceName: "Stock Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2040 },
    { resourceKey: "menu.stock.buying", resourceName: "Stock Menu - Buying", routePattern: "/stock", resourceType: "menu", sortOrder: 2041 },
    { resourceKey: "menu.stock.orders", resourceName: "Stock Menu - Orders", routePattern: "/stock/items", resourceType: "menu", sortOrder: 2042 },
    { resourceKey: "menu.stock.history", resourceName: "Stock Menu - History", routePattern: "/stock/history", resourceType: "menu", sortOrder: 2043 },
    { resourceKey: "menu.stock.ingredients", resourceName: "Stock Menu - Ingredients", routePattern: "/stock/ingredients", resourceType: "menu", sortOrder: 2044 },
    { resourceKey: "menu.stock.ingredientsUnit", resourceName: "Stock Menu - Ingredient Units", routePattern: "/stock/ingredientsUnit", resourceType: "menu", sortOrder: 2045 },
    { resourceKey: "menu.users.home", resourceName: "Users Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2050 },
    { resourceKey: "menu.branch.home", resourceName: "Branch Menu - Home", routePattern: "/", resourceType: "menu", sortOrder: 2051 },
    { resourceKey: "permissions.page", resourceName: "Permissions", routePattern: "/users/permissions", resourceType: "page", sortOrder: 10 },
    { resourceKey: "users.page", resourceName: "Users", routePattern: "/users", resourceType: "page", sortOrder: 11 },
    { resourceKey: "roles.page", resourceName: "Roles", routePattern: "/roles", resourceType: "page", sortOrder: 12 },
    { resourceKey: "branches.page", resourceName: "Branches", routePattern: "/branch", resourceType: "page", sortOrder: 13 },
    { resourceKey: "audit.page", resourceName: "Audit Logs", routePattern: "/audit", resourceType: "page", sortOrder: 14 },
    { resourceKey: "health_system.page", resourceName: "Health System", routePattern: "/Health-System", resourceType: "page", sortOrder: 15 },
    { resourceKey: "orders.page", resourceName: "Orders", routePattern: "/pos/orders", resourceType: "page", sortOrder: 20 },
    { resourceKey: "orders.edit.feature", resourceName: "Orders Edit Action", routePattern: "/pos/orders", resourceType: "feature", sortOrder: 20_1 },
    { resourceKey: "orders.cancel.feature", resourceName: "Orders Cancel Action", routePattern: "/pos/orders", resourceType: "feature", sortOrder: 20_2 },
    { resourceKey: "products.page", resourceName: "Products", routePattern: "/pos/products", resourceType: "page", sortOrder: 21 },
    { resourceKey: "products_unit.page", resourceName: "Product Units", routePattern: "/pos/productsUnit", resourceType: "page", sortOrder: 22 },
    { resourceKey: "category.page", resourceName: "Category", routePattern: "/pos/category", resourceType: "page", sortOrder: 23 },
    { resourceKey: "queue.page", resourceName: "Queue", routePattern: "/pos/queue", resourceType: "page", sortOrder: 24 },
    { resourceKey: "payments.page", resourceName: "Payments", routePattern: "/pos/payments", resourceType: "page", sortOrder: 25 },
    { resourceKey: "delivery.page", resourceName: "Delivery", routePattern: "/pos/delivery", resourceType: "page", sortOrder: 26 },
    { resourceKey: "discounts.page", resourceName: "Discounts", routePattern: "/pos/discounts", resourceType: "page", sortOrder: 27 },
    { resourceKey: "payment_method.page", resourceName: "Payment Method", routePattern: "/pos/paymentMethod", resourceType: "page", sortOrder: 28 },
    { resourceKey: "tables.page", resourceName: "Tables", routePattern: "/pos/tables", resourceType: "page", sortOrder: 29 },
    { resourceKey: "shop_profile.page", resourceName: "Shop Profile", routePattern: "/pos/settings", resourceType: "page", sortOrder: 30 },
    { resourceKey: "payment_accounts.page", resourceName: "Payment Accounts", routePattern: "/pos/settings/payment-accounts", resourceType: "page", sortOrder: 31 },
    { resourceKey: "print_settings.page", resourceName: "Print Settings", routePattern: "/print-setting", resourceType: "page", sortOrder: 32 },
    { resourceKey: "shifts.page", resourceName: "Shifts", routePattern: "/pos/shift", resourceType: "page", sortOrder: 33 },
    { resourceKey: "reports.sales.page", resourceName: "Sales Report", routePattern: "/pos/dashboard", resourceType: "page", sortOrder: 34 },
    { resourceKey: "stock.ingredients.page", resourceName: "Stock Ingredients", routePattern: "/stock/ingredients", resourceType: "page", sortOrder: 40 },
    { resourceKey: "stock.ingredients_unit.page", resourceName: "Stock Units", routePattern: "/stock/ingredientsUnit", resourceType: "page", sortOrder: 41 },
    { resourceKey: "stock.orders.page", resourceName: "Stock Orders", routePattern: "/stock/items", resourceType: "page", sortOrder: 42 },
];

const MANAGER_RESTRICTED_RESOURCES = new Set<string>([
    "permissions.page",
    "roles.page",
    "audit.page",
    "health_system.page",
    "menu.module.audit",
]);

const EMPLOYEE_READ_ALLOW = new Set<string>([
    "orders.page",
    "products.page",
    "products_unit.page",
    "queue.page",
    "shifts.page",
    "payments.page",
    "category.page",
    "delivery.page",
    "discounts.page",
    "payment_method.page",
    "tables.page",
    "shop_profile.page",
    "menu.main.home",
    "menu.module.pos",
]);

const EMPLOYEE_MENU_PREFIX_ALLOW = ["menu.pos."];
const EMPLOYEE_WRITE_ALLOW = new Set<string>(["orders.page", "queue.page", "payments.page", "shifts.page"]);
const ORDER_EDIT_FEATURE = "orders.edit.feature";
const ORDER_CANCEL_FEATURE = "orders.cancel.feature";

function normalizeRoleName(roleName: string): RoleName | null {
    const value = roleName.trim().toLowerCase();
    if (value === "admin") return "Admin";
    if (value === "manager" || value === "maneger") return "Manager";
    if (value === "employee") return "Employee";
    return null;
}

function toPermissionPolicy(
    roleName: RoleName,
    resource: PermissionResourceRow,
    actionKey: ActionKey
): PermissionPolicy {
    if (roleName === "Admin") {
        return { effect: "allow", scope: "all" };
    }

    const resourceKey = resource.resource_key;
    const isMenu = resource.resource_type === "menu";

    if (resourceKey === ORDER_EDIT_FEATURE) {
        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "branch" };
        }
        return { effect: "deny", scope: "none" };
    }

    if (resourceKey === ORDER_CANCEL_FEATURE) {
        return { effect: "deny", scope: "none" };
    }

    if (roleName === "Manager") {
        if (MANAGER_RESTRICTED_RESOURCES.has(resourceKey)) {
            return { effect: "deny", scope: "none" };
        }

        if (actionKey === "access" || actionKey === "view") {
            return { effect: "allow", scope: "branch" };
        }

        if (isMenu) {
            return { effect: "deny", scope: "none" };
        }

        if (resourceKey === "branches.page") {
            return { effect: "deny", scope: "none" };
        }

        if (actionKey === "delete") {
            return { effect: "deny", scope: "none" };
        }

        return { effect: "allow", scope: "branch" };
    }

    if (actionKey === "delete") {
        return { effect: "deny", scope: "none" };
    }

    if (actionKey === "access" || actionKey === "view") {
        if (EMPLOYEE_READ_ALLOW.has(resourceKey)) {
            return { effect: "allow", scope: "branch" };
        }

        if (isMenu && EMPLOYEE_MENU_PREFIX_ALLOW.some((prefix) => resourceKey.startsWith(prefix))) {
            return { effect: "allow", scope: "branch" };
        }

        return { effect: "deny", scope: "none" };
    }

    if (EMPLOYEE_WRITE_ALLOW.has(resourceKey) && (actionKey === "create" || actionKey === "update")) {
        return { effect: "allow", scope: "branch" };
    }

    return { effect: "deny", scope: "none" };
}

async function tableExists(queryRunner: QueryRunner, tableName: string): Promise<boolean> {
    const rows = await queryRunner.query(`SELECT to_regclass($1) AS regclass`, [tableName]);
    return Boolean(rows?.[0]?.regclass);
}

async function ensureDefaultBranch(queryRunner: QueryRunner): Promise<string | null> {
    if (!(await tableExists(queryRunner, "public.branches"))) {
        return null;
    }

    const existing = await queryRunner.query(
        `SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`
    );
    if (existing?.[0]?.id) {
        return existing[0].id as string;
    }

    const branchName = process.env.BOOTSTRAP_DEFAULT_BRANCH_NAME || "Main Branch";
    const branchCode = process.env.BOOTSTRAP_DEFAULT_BRANCH_CODE || "MB";

    const inserted = await queryRunner.query(
        `
            INSERT INTO branches (branch_name, branch_code, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (branch_code)
            DO UPDATE SET branch_name = EXCLUDED.branch_name, is_active = true
            RETURNING id
        `,
        [branchName, branchCode]
    );

    return (inserted?.[0]?.id as string) || null;
}

async function ensureCoreRoles(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, "public.roles"))) {
        return;
    }

    for (const role of CORE_ROLES) {
        await queryRunner.query(
            `
                INSERT INTO roles (roles_name, display_name)
                VALUES ($1, $2)
                ON CONFLICT (roles_name)
                DO UPDATE SET display_name = EXCLUDED.display_name
            `,
            [role.roleName, role.displayName]
        );
    }
}

async function ensurePermissionActions(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, "public.permission_actions"))) {
        return;
    }

    for (const actionKey of ACTION_KEYS) {
        await queryRunner.query(
            `
                INSERT INTO permission_actions (action_key, action_name, is_active)
                VALUES ($1, $2, true)
                ON CONFLICT (action_key)
                DO UPDATE SET action_name = EXCLUDED.action_name, is_active = true
            `,
            [actionKey, actionKey]
        );
    }
}

async function ensurePermissionResources(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, "public.permission_resources"))) {
        return;
    }

    for (const resource of CORE_PERMISSION_RESOURCES) {
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
}

async function ensureRolePermissionDefaults(queryRunner: QueryRunner): Promise<void> {
    const hasRoles = await tableExists(queryRunner, "public.roles");
    const hasResources = await tableExists(queryRunner, "public.permission_resources");
    const hasActions = await tableExists(queryRunner, "public.permission_actions");
    const hasRolePermissions = await tableExists(queryRunner, "public.role_permissions");
    if (!hasRoles || !hasResources || !hasActions || !hasRolePermissions) {
        return;
    }

    const roleRows = (await queryRunner.query(
        `
            SELECT id, roles_name
            FROM roles
            WHERE lower(roles_name) IN ('admin', 'manager', 'maneger', 'employee')
        `
    )) as Array<{ id: string; roles_name: string }>;
    const roles: RoleRow[] = roleRows
        .map((row) => {
            const normalized = normalizeRoleName(row.roles_name);
            if (!normalized) return null;
            return { id: row.id, roles_name: normalized };
        })
        .filter((row): row is RoleRow => !!row);

    if (roles.length === 0) {
        return;
    }

    const resources = (await queryRunner.query(
        `SELECT id, resource_key, resource_type FROM permission_resources WHERE is_active = true`
    )) as PermissionResourceRow[];
    const actions = (await queryRunner.query(
        `SELECT id, action_key FROM permission_actions WHERE is_active = true`
    )) as PermissionActionRow[];

    for (const role of roles) {
        for (const resource of resources) {
            for (const action of actions) {
                const policy = toPermissionPolicy(role.roles_name, resource, action.action_key);
                await queryRunner.query(
                    `
                        INSERT INTO role_permissions (role_id, resource_id, action_id, effect, scope)
                        SELECT $1, $2, $3, $4, $5
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM role_permissions
                            WHERE role_id = $1
                              AND resource_id = $2
                              AND action_id = $3
                        )
                    `,
                    [role.id, resource.id, action.id, policy.effect, policy.scope]
                );
            }
        }
    }
}

async function ensureDefaultAdminUser(queryRunner: QueryRunner, fallbackBranchId: string | null): Promise<void> {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (!username || !password) {
        return;
    }

    const hasUsers = await tableExists(queryRunner, "public.users");
    const hasRoles = await tableExists(queryRunner, "public.roles");
    if (!hasUsers || !hasRoles) {
        return;
    }

    const roleRows = await queryRunner.query(
        `SELECT id FROM roles WHERE lower(roles_name) = 'admin' LIMIT 1`
    );
    const adminRoleId = roleRows?.[0]?.id as string | undefined;
    if (!adminRoleId) {
        return;
    }

    let branchId = process.env.BOOTSTRAP_ADMIN_BRANCH_ID?.trim() || fallbackBranchId || null;
    if (!branchId && (await tableExists(queryRunner, "public.branches"))) {
        const rows = await queryRunner.query(
            `SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`
        );
        branchId = (rows?.[0]?.id as string | undefined) || null;
    }

    if (!branchId) {
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "System Administrator";

    const existingRows = await queryRunner.query(
        `SELECT id FROM users WHERE username = $1 LIMIT 1`,
        [username]
    );

    if (existingRows?.[0]?.id) {
        await queryRunner.query(
            `
                UPDATE users
                SET name = $1,
                    password = $2,
                    roles_id = $3,
                    branch_id = $4,
                    is_use = true
                WHERE id = $5
            `,
            [displayName, passwordHash, adminRoleId, branchId, existingRows[0].id]
        );
        return;
    }

    await queryRunner.query(
        `
            INSERT INTO users (username, name, password, roles_id, branch_id, is_use, is_active)
            VALUES ($1, $2, $3, $4, $5, true, false)
        `,
        [username, displayName, passwordHash, adminRoleId, branchId]
    );
}

export async function ensureRbacDefaults(dataSource: DataSource): Promise<void> {
    const enabled = process.env.RUN_RBAC_BASELINE_ON_START !== "false";
    if (!enabled) {
        return;
    }

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
        // Bootstrap must run with admin RLS context to seed branch/user rows when policies are enabled.
        await queryRunner.query(`SELECT set_config('app.is_admin', 'true', false)`);
        await queryRunner.query(`SELECT set_config('app.branch_id', '', false)`);
        await queryRunner.query(`SELECT set_config('app.user_id', '', false)`);

        await ensureCoreRoles(queryRunner);
        await ensurePermissionActions(queryRunner);
        await ensurePermissionResources(queryRunner);
        const defaultBranchId = await ensureDefaultBranch(queryRunner);
        await ensureRolePermissionDefaults(queryRunner);
        await ensureDefaultAdminUser(queryRunner, defaultBranchId);
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }
}
