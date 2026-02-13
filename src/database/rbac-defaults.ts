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

const MANAGER_RESTRICTED_RESOURCES = new Set<string>([
    "permissions.page",
    "roles.page",
    "audit.page",
    "menu.module.audit",
]);

const EMPLOYEE_READ_ALLOW = new Set<string>([
    "orders.page",
    "products.page",
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
