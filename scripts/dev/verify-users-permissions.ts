import { AppDataSource } from "../../src/database/database";
import { Branch } from "../../src/entity/Branch";
import { Users } from "../../src/entity/Users";
import { Roles } from "../../src/entity/Roles";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { UserPermission } from "../../src/entity/UserPermission";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { runWithDbContext } from "../../src/database/dbContext";

type Scope = "none" | "own" | "branch" | "all";
type Effect = "allow" | "deny";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ALLOW_NONLOCAL_SEED = process.env.ALLOW_NONLOCAL_SEED === "1";

function assert(condition: any, message: string) {
    if (!condition) throw new Error(message);
}

function logOk(msg: string) {
    process.stdout.write(`[OK] ${msg}\n`);
}

function logInfo(msg: string) {
    process.stdout.write(`[INFO] ${msg}\n`);
}

function makeUsername(prefix: string, runId: string): string {
    // Backend enforces username max length 20.
    const safePrefix = String(prefix || "u")
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, Math.max(1, 20 - 1 - runId.length));
    return `${safePrefix}_${runId}`.slice(0, 20);
}

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

function pickCookie(setCookie: string | null, key: string): string {
    if (!setCookie) return "";
    const parts = setCookie.split(/,(?=[^;]+=[^;]+)/g);
    for (const part of parts) {
        const m = part.match(new RegExp(`${key}=([^;]+)`));
        if (m?.[1]) return `${key}=${m[1]}`;
    }
    return "";
}

async function login(username: string, password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ username, password }),
        redirect: "manual",
    });

    const payload = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(`Login failed (${res.status}): ${JSON.stringify(payload)}`);
    }

    const setCookie = res.headers.get("set-cookie");
    const tokenCookie = pickCookie(setCookie, "token");
    if (!tokenCookie) {
        throw new Error("Login succeeded but token cookie not found in response headers.");
    }
    return tokenCookie;
}

async function getCsrf(cookie: string): Promise<{ cookie: string; csrfToken: string }> {
    const res = await fetch(`${BASE_URL}/csrf-token`, {
        method: "GET",
        headers: { accept: "application/json", cookie },
        redirect: "manual",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || typeof json?.csrfToken !== "string" || !json.csrfToken) {
        throw new Error(`Failed to get CSRF token (${res.status}): ${JSON.stringify(json)}`);
    }

    const setCookie = res.headers.get("set-cookie");
    const csrfCookie = pickCookie(setCookie, "_csrf");
    const combined = csrfCookie ? `${cookie}; ${csrfCookie}` : cookie;
    return { cookie: combined, csrfToken: json.csrfToken };
}

async function apiCall(
    path: string,
    method: string,
    cookie: string,
    options?: { body?: unknown; csrfToken?: string }
): Promise<{ status: number; json: any }> {
    const headers: Record<string, string> = { accept: "application/json", cookie };
    const body = options?.body;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (options?.csrfToken) headers["x-csrf-token"] = options.csrfToken;
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
}

async function ensureRoleByName(roleName: "Admin" | "Manager" | "Employee"): Promise<Roles> {
    const repo = AppDataSource.getRepository(Roles);
    const found = await repo.findOne({ where: { roles_name: roleName } as any });
    if (found) return found;
    const all = await repo.find();
    const fallback = all.find((r) => String(r.roles_name || "").toLowerCase() === roleName.toLowerCase());
    if (fallback) return fallback;
    throw new Error(`Role not found: ${roleName}`);
}

async function createTestBranch(label: string, runId: string): Promise<Branch> {
    const repo = AppDataSource.getRepository(Branch);
    const branch = repo.create({
        branch_name: `User Verify ${label} ${runId}`,
        branch_code: `UV${label}${runId}`.slice(0, 20),
        is_active: true,
        address: `Verify addr ${label}`,
        phone: `08${Math.floor(Math.random() * 1_000_0000).toString().padStart(7, "0")}`.slice(0, 20),
        tax_id: `TAX-${runId}`,
    });
    return (await repo.save(branch as any)) as Branch;
}

async function createTestUser(params: { username: string; password: string; roleId: string; branchId: string; name?: string }): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = repo.create({
        username: params.username,
        name: params.name ?? params.username,
        password: passwordHash,
        roles_id: params.roleId,
        branch_id: params.branchId,
        is_use: true,
        is_active: false,
    });
    return (await repo.save(user as any)) as Users;
}

async function ensurePermissionResource(resource_key: string): Promise<PermissionResource> {
    const repo = AppDataSource.getRepository(PermissionResource);
    const existing = await repo.findOneBy({ resource_key } as any);
    if (existing) return existing;

    const created = repo.create({
        resource_key,
        resource_name: resource_key,
        resource_type: "page",
        sort_order: 0,
        is_active: true,
    });
    return (await repo.save(created as any)) as PermissionResource;
}

async function ensurePermissionAction(action_key: string): Promise<PermissionAction> {
    const repo = AppDataSource.getRepository(PermissionAction);
    const existing = await repo.findOneBy({ action_key } as any);
    if (existing) return existing;

    const created = repo.create({
        action_key,
        action_name: action_key,
        is_active: true,
    });
    return (await repo.save(created as any)) as PermissionAction;
}

async function setUserPermission(params: {
    userId: string;
    resourceId: string;
    actionId: string;
    effect: Effect;
    scope: Scope;
}) {
    const repo = AppDataSource.getRepository(UserPermission);
    await repo.delete({ user_id: params.userId, resource_id: params.resourceId, action_id: params.actionId } as any);
    await repo.save(
        repo.create({
            user_id: params.userId,
            resource_id: params.resourceId,
            action_id: params.actionId,
            effect: params.effect,
            scope: params.scope,
        } as any)
    );
}

async function ensureAdminCookie(branchIdForNewAdmin: string): Promise<{ cookie: string; createdUser?: { username: string; password: string } }> {
    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
        try {
            const cookie = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
            return { cookie };
        } catch {
            // Fall back to creating a local admin user so the verification can still run end-to-end.
        }
    }

    const adminRole = await ensureRoleByName("Admin");
    const runId = randomUUID().replace(/-/g, "").slice(0, 8);
    const username = `admin_verify_${runId}`;
    const password = `Admin${runId}!`;
    await createTestUser({ username, password, roleId: adminRole.id, branchId: branchIdForNewAdmin, name: "Admin Verify" });
    const cookie = await login(username, password);
    return { cookie, createdUser: { username, password } };
}

async function explainUsersSearch(runId: string) {
    await AppDataSource.query(`ANALYZE "users"`);
    await AppDataSource.query(`ANALYZE "roles"`);

    const term = runId;
    const normal = await AppDataSource.query(`
        EXPLAIN
        SELECT users.id
        FROM "users" users
        LEFT JOIN roles roles ON roles.id = users.roles_id
        LEFT JOIN branches branch ON branch.id = users.branch_id
        WHERE (
            users.username ILIKE '%${term}%'
            OR users.name ILIKE '%${term}%'
            OR roles.display_name ILIKE '%${term}%'
            OR roles.roles_name ILIKE '%${term}%'
            OR branch.branch_name ILIKE '%${term}%'
        )
        ORDER BY users.create_date DESC
        LIMIT 20
    `);
    const normalPlan = normal.map((r: any) => r["QUERY PLAN"]).join("\n");
    logInfo("EXPLAIN (planner default):");
    process.stdout.write(`${normalPlan}\n`);

    const idxRows = await AppDataSource.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('users', 'roles')
          AND indexname ILIKE '%trgm%'
        ORDER BY indexname
    `);
    assert(Array.isArray(idxRows) && idxRows.length > 0, "No trigram indexes found on users/roles. Run migration 1772400000000.");
    logInfo(`Found trigram indexes: ${idxRows.map((r: any) => r.indexname).join(", ")}`);

    await AppDataSource.query(`SET enable_seqscan=off`);
    const forced = await AppDataSource.query(`
        EXPLAIN
        SELECT id
        FROM "users"
        WHERE username ILIKE '%${term}%'
        ORDER BY create_date DESC
        LIMIT 20
    `);
    await AppDataSource.query(`RESET enable_seqscan`);
    const forcedPlan = forced.map((r: any) => r["QUERY PLAN"]).join("\n");
    logInfo("EXPLAIN (enable_seqscan=off) username:");
    process.stdout.write(`${forcedPlan}\n`);
    assert(/idx_users_username_trgm/i.test(forcedPlan), "Expected idx_users_username_trgm usage in forced plan.");
    logOk("Users search can use trigram indexes (verified via forced plan)");
}

async function main() {
    // Safety: refuse to seed verification data into non-local databases unless explicitly overridden.
    const dbHost = String(process.env.DATABASE_HOST || "").trim().toLowerCase();
    const isLocalHost =
        dbHost === "localhost" ||
        dbHost === "127.0.0.1" ||
        dbHost === "::1" ||
        dbHost === "db" ||
        dbHost.endsWith(".local");
    if (!isLocalHost && !ALLOW_NONLOCAL_SEED) {
        throw new Error(
            `Refusing to seed verification data on non-local DATABASE_HOST=${process.env.DATABASE_HOST}. ` +
            `Set ALLOW_NONLOCAL_SEED=1 to override (not recommended).`
        );
    }

    const health = await fetch(`${BASE_URL}/health`).catch(() => null);
    assert(health && (health as any).ok, `Server not reachable at ${BASE_URL} (GET /health failed)`);
    logOk(`Server reachable: ${BASE_URL}`);

    await ensureDb();

    const runId = randomUUID().replace(/-/g, "").slice(0, 8);

    const seeded = await runWithDbContext(
        { branchId: undefined, userId: "00000000-0000-0000-0000-000000000000", role: "Admin", isAdmin: true },
        async () => {
            const adminRole = await ensureRoleByName("Admin");
            const managerRole = await ensureRoleByName("Manager");
            const employeeRole = await ensureRoleByName("Employee");

            const branchA = await createTestBranch("A", runId);
            const branchB = await createTestBranch("B", runId);

            const resource = await ensurePermissionResource("users.page");
            const view = await ensurePermissionAction("view");
            const create = await ensurePermissionAction("create");
            const update = await ensurePermissionAction("update");
            const del = await ensurePermissionAction("delete");

            const managerPass = `Manager${runId}!`;
            const employeePass = `Employee${runId}!`;

            const managerA = await createTestUser({
                username: makeUsername("mgrA", runId),
                password: managerPass,
                roleId: managerRole.id,
                branchId: branchA.id,
                name: `MgrA ${runId}`,
            });

            const managerB = await createTestUser({
                username: makeUsername("mgrB", runId),
                password: managerPass,
                roleId: managerRole.id,
                branchId: branchB.id,
                name: `MgrB ${runId}`,
            });

            const employeeA = await createTestUser({
                username: makeUsername("empA", runId),
                password: employeePass,
                roleId: employeeRole.id,
                branchId: branchA.id,
                name: `EmpA ${runId}`,
            });

            const employeeB = await createTestUser({
                username: makeUsername("empB", runId),
                password: employeePass,
                roleId: employeeRole.id,
                branchId: branchB.id,
                name: `EmpB ${runId}`,
            });

            // Make manager permissions deterministic (regardless of role_permissions defaults).
            await setUserPermission({ userId: managerA.id, resourceId: resource.id, actionId: view.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: managerA.id, resourceId: resource.id, actionId: create.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: managerA.id, resourceId: resource.id, actionId: update.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: managerA.id, resourceId: resource.id, actionId: del.id, effect: "deny", scope: "none" });

            return {
                runId,
                roles: { adminRole, managerRole, employeeRole },
                branchA,
                branchB,
                managerA,
                managerB,
                employeeA,
                employeeB,
                managerPass,
                employeePass,
            };
        }
    );
    logOk("Seeded test branches/users/permissions for Users verification");

    // Admin flow: full CRUD should work.
    const adminAuth = await ensureAdminCookie(seeded.branchA.id);
    if (adminAuth.createdUser) {
        logInfo(`Created local admin user for verification: ${adminAuth.createdUser.username} / ${adminAuth.createdUser.password}`);
    }
    const adminCookie = adminAuth.cookie;
    const adminCsrf = await getCsrf(adminCookie);

    const adminList = await apiCall(`/users?page=1&limit=50&q=${seeded.runId}`, "GET", adminCookie);
    assert(adminList.status === 200, `admin list: expected 200, got ${adminList.status}`);
    const adminListStr = JSON.stringify(adminList.json ?? {});
    assert(!/\"password\"\\s*:/i.test(adminListStr), "password field leaked in /users list response");
    logOk("password is not present in /users list responses");

    const adminCreate = await apiCall(
        `/users`,
        "POST",
        adminCsrf.cookie,
        {
            csrfToken: adminCsrf.csrfToken,
            body: {
                username: makeUsername("admC", seeded.runId),
                name: `Created ${seeded.runId}`,
                password: `P@ss${seeded.runId}!`,
                roles_id: seeded.roles.employeeRole.id,
                branch_id: seeded.branchB.id,
                is_use: true,
                is_active: false,
            },
        }
    );
    assert(
        adminCreate.status === 201,
        `admin create: expected 201, got ${adminCreate.status}. body=${JSON.stringify(adminCreate.json)}`
    );
    const createdId = adminCreate.json?.data?.id;
    assert(typeof createdId === "string" && createdId.length > 0, "admin create: missing id");
    logOk("admin can create user (201)");

    const adminUpdate = await apiCall(
        `/users/${createdId}`,
        "PUT",
        adminCsrf.cookie,
        { csrfToken: adminCsrf.csrfToken, body: { name: `Updated ${seeded.runId}` } }
    );
    assert(adminUpdate.status === 200, `admin update: expected 200, got ${adminUpdate.status}`);
    logOk("admin can update user (200)");

    const adminDelete = await apiCall(`/users/${createdId}`, "DELETE", adminCsrf.cookie, { csrfToken: adminCsrf.csrfToken });
    assert(adminDelete.status === 204, `admin delete: expected 204, got ${adminDelete.status}`);
    logOk("admin can delete user (204)");

    // Manager scope: must stay inside branch and only manage employees.
    const mgrCookie = await login(seeded.managerA.username, seeded.managerPass);
    const mgrCsrf = await getCsrf(mgrCookie);

    const mgrList = await apiCall(`/users?page=1&limit=200&q=${seeded.runId}`, "GET", mgrCookie);
    assert(mgrList.status === 200, `manager list: expected 200, got ${mgrList.status}`);
    const mgrRows = (mgrList.json?.data ?? []) as Array<any>;
    assert(mgrRows.length > 0, "manager list: expected at least one row");
    assert(
        mgrRows.every((u) => u?.branch_id === seeded.branchA.id || u?.branch?.id === seeded.branchA.id),
        "manager list leaked users outside branch"
    );
    assert(
        mgrRows.every((u) => (u?.roles?.roles_name ?? u?.roles_name) === "Employee" || u?.id === seeded.managerA.id),
        "manager list leaked non-employee users (other than self)"
    );
    logOk("manager list is restricted to own branch + employees (and self)");

    const mgrGetOther = await apiCall(`/users/${seeded.employeeB.id}`, "GET", mgrCookie);
    assert(mgrGetOther.status === 404, `manager get other-branch: expected 404, got ${mgrGetOther.status}`);
    logOk("manager cannot access other-branch user detail (404)");

    const mgrCreateManager = await apiCall(
        `/users`,
        "POST",
        mgrCsrf.cookie,
        {
            csrfToken: mgrCsrf.csrfToken,
            body: {
                username: makeUsername("mCM", seeded.runId),
                name: `Should Fail ${seeded.runId}`,
                password: `P@ss${seeded.runId}!`,
                roles_id: seeded.roles.managerRole.id,
                branch_id: seeded.branchB.id,
            },
        }
    );
    assert(mgrCreateManager.status === 403, `manager create Manager: expected 403, got ${mgrCreateManager.status}`);
    logOk("manager cannot create Admin/Manager users (403)");

    const mgrCreateEmployee = await apiCall(
        `/users`,
        "POST",
        mgrCsrf.cookie,
        {
            csrfToken: mgrCsrf.csrfToken,
            body: {
                username: makeUsername("mCE", seeded.runId),
                name: `CreatedByMgr ${seeded.runId}`,
                password: `P@ss${seeded.runId}!`,
                roles_id: seeded.roles.employeeRole.id,
                // Even if client attempts cross-branch, middleware must force manager branch.
                branch_id: seeded.branchB.id,
                is_use: true,
            },
        }
    );
    assert(mgrCreateEmployee.status === 201, `manager create Employee: expected 201, got ${mgrCreateEmployee.status}`);
    assert(
        mgrCreateEmployee.json?.data?.branch_id === seeded.branchA.id ||
        mgrCreateEmployee.json?.data?.branch?.id === seeded.branchA.id,
        "manager create: branch_id was not forced to manager branch"
    );
    logOk("manager can create Employee in own branch only (201)");

    const mgrDelete = await apiCall(`/users/${seeded.employeeA.id}`, "DELETE", mgrCsrf.cookie, { csrfToken: mgrCsrf.csrfToken });
    assert(
        mgrDelete.status === 403,
        `manager delete: expected 403, got ${mgrDelete.status}. body=${JSON.stringify(mgrDelete.json)}`
    );
    logOk("manager cannot delete users (403)");

    await explainUsersSearch(seeded.runId);

    logOk("Users verification completed");
    logInfo(`Created test users (local only):`);
    logInfo(`- ${seeded.managerA.username} / ${seeded.managerPass} (Manager, branch A)`);
    logInfo(`- ${seeded.employeeA.username} / ${seeded.employeePass} (Employee, branch A)`);
    logInfo(`- ${seeded.employeeB.username} / ${seeded.employeePass} (Employee, branch B)`);
}

main()
    .then(async () => {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        process.exit(0);
    })
    .catch(async (err) => {
        console.error("[FAIL]", err);
        try {
            if (AppDataSource.isInitialized) {
                await AppDataSource.destroy();
            }
        } finally {
            process.exit(1);
        }
    });
