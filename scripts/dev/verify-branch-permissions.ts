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

async function ensureAdminRole(): Promise<Roles> {
    const repo = AppDataSource.getRepository(Roles);
    const role = await repo.findOne({
        where: { roles_name: "Admin" } as any,
    });
    if (role) return role;

    const all = await repo.find();
    const found = all.find((r) => String(r.roles_name || "").toLowerCase() === "admin");
    if (found) return found;
    throw new Error("Admin role not found in roles table.");
}

async function createAdminUser(params: { username: string; password: string; roleId: string; branchId: string }): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = repo.create({
        username: params.username,
        password: passwordHash,
        roles_id: params.roleId,
        branch_id: params.branchId,
        is_use: true,
        is_active: false,
    });
    return (await repo.save(user as any)) as Users;
}

async function ensureAdminCookie(branchIdForNewAdmin: string): Promise<{ cookie: string; username: string; password: string; created: boolean }> {
    // 1) Try user-provided admin credentials first (if provided)
    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
        try {
            const cookie = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
            return { cookie, username: ADMIN_USERNAME, password: ADMIN_PASSWORD, created: false };
        } catch {
            // fall through to create a new admin user for this local DB
        }
    }

    // 2) Create a new local admin user so tests can run end-to-end.
    const adminRole = await ensureAdminRole();
    const runId = randomUUID().replace(/-/g, "").slice(0, 8);
    const username = `admin_verify_${runId}`;
    const password = `Admin${runId}!`;
    await createAdminUser({ username, password, roleId: adminRole.id, branchId: branchIdForNewAdmin });
    const cookie = await login(username, password);
    return { cookie, username, password, created: true };
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

async function ensureDb() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
}

async function ensureRoleNonAdmin(): Promise<Roles> {
    const repo = AppDataSource.getRepository(Roles);
    const existing = await repo.find();
    const nonAdmin = existing.find((r) => String(r.roles_name || "").toLowerCase() !== "admin");
    if (nonAdmin) return nonAdmin;

    const role = repo.create({ roles_name: "Staff", display_name: "Staff" });
    return (await repo.save(role as any)) as Roles;
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

async function createTestBranch(label: string): Promise<Branch> {
    const repo = AppDataSource.getRepository(Branch);
    const runId = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const branch = repo.create({
        branch_name: `Branch Verify ${label} ${runId}`,
        branch_code: `BV${runId}`.slice(0, 20),
        is_active: true,
        address: `Verify addr ${label}`,
        phone: `08${Math.floor(Math.random() * 1_000_0000).toString().padStart(7, "0")}`.slice(0, 20),
        tax_id: `TAX-${runId}`,
    });
    return (await repo.save(branch as any)) as Branch;
}

async function createTestUser(params: { username: string; password: string; roleId: string; branchId: string }): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = repo.create({
        username: params.username,
        password: passwordHash,
        roles_id: params.roleId,
        branch_id: params.branchId,
        is_use: true,
        is_active: false,
    });
    return (await repo.save(user as any)) as Users;
}

async function explainBranchSearch() {
    await AppDataSource.query(`ANALYZE branches`);
    const term = "Verify";

    const orSql = `(
        branch_name ILIKE '%${term}%'
        OR branch_code ILIKE '%${term}%'
        OR address ILIKE '%${term}%'
        OR phone ILIKE '%${term}%'
    )`;

    const normal = await AppDataSource.query(`
        EXPLAIN
        SELECT id
        FROM branches
        WHERE ${orSql}
        ORDER BY create_date DESC
        LIMIT 20
    `);
    const normalPlan = normal.map((r: any) => r["QUERY PLAN"]).join("\n");
    logInfo("EXPLAIN (planner default):");
    process.stdout.write(`${normalPlan}\n`);

    const idxRows = await AppDataSource.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'branches'
          AND indexname ILIKE '%trgm%'
        ORDER BY indexname
    `);
    assert(Array.isArray(idxRows) && idxRows.length > 0, "No trigram indexes found on branches.");
    logInfo(`Found trigram indexes: ${idxRows.map((r: any) => r.indexname).join(", ")}`);

    await AppDataSource.query(`SET enable_seqscan=off`);
    const forced = await AppDataSource.query(`
        EXPLAIN
        SELECT id
        FROM branches
        WHERE branch_name ILIKE '%${term}%'
        ORDER BY create_date DESC
        LIMIT 20
    `);
    await AppDataSource.query(`RESET enable_seqscan`);
    const forcedPlan = forced.map((r: any) => r["QUERY PLAN"]).join("\n");
    logInfo("EXPLAIN (enable_seqscan=off) branch_name:");
    process.stdout.write(`${forcedPlan}\n`);
    assert(/idx_branches_branch_name_trgm/i.test(forcedPlan), "Expected idx_branches_branch_name_trgm usage in forced plan.");
    logOk("Branch search can use trigram indexes (verified via forced plan)");
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

    // Server reachable.
    const health = await fetch(`${BASE_URL}/health`).catch(() => null);
    assert(health && (health as any).ok, `Server not reachable at ${BASE_URL} (GET /health failed)`);
    logOk(`Server reachable: ${BASE_URL}`);

    await ensureDb();

    const seeded = await runWithDbContext(
        { branchId: undefined, userId: "00000000-0000-0000-0000-000000000000", role: "Admin", isAdmin: true },
        async () => {
            const role = await ensureRoleNonAdmin();

            const branchA = await createTestBranch("A");
            const branchB = await createTestBranch("B");

            const resource = await ensurePermissionResource("branches.page");
            const view = await ensurePermissionAction("view");
            const create = await ensurePermissionAction("create");
            const update = await ensurePermissionAction("update");
            const del = await ensurePermissionAction("delete");

            const runId = randomUUID().replace(/-/g, "").slice(0, 8);

            const viewUserPass = `View${runId}!`;
            const editUserPass = `Edit${runId}!`;
            const noneUserPass = `None${runId}!`;

            const viewUser = await createTestUser({
                username: `branch_view_${runId}`,
                password: viewUserPass,
                roleId: role.id,
                branchId: branchA.id,
            });
            const editUser = await createTestUser({
                username: `branch_edit_${runId}`,
                password: editUserPass,
                roleId: role.id,
                branchId: branchA.id,
            });
            const noneUser = await createTestUser({
                username: `branch_none_${runId}`,
                password: noneUserPass,
                roleId: role.id,
                branchId: branchA.id,
            });

            // Force user-level permissions to make tests deterministic, regardless of role_permissions defaults.
            // viewUser: allow view, deny everything else.
            await setUserPermission({ userId: viewUser.id, resourceId: resource.id, actionId: view.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: viewUser.id, resourceId: resource.id, actionId: create.id, effect: "deny", scope: "none" });
            await setUserPermission({ userId: viewUser.id, resourceId: resource.id, actionId: update.id, effect: "deny", scope: "none" });
            await setUserPermission({ userId: viewUser.id, resourceId: resource.id, actionId: del.id, effect: "deny", scope: "none" });

            // editUser: allow view + update (but API should still be Admin-only).
            await setUserPermission({ userId: editUser.id, resourceId: resource.id, actionId: view.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: editUser.id, resourceId: resource.id, actionId: update.id, effect: "allow", scope: "branch" });
            await setUserPermission({ userId: editUser.id, resourceId: resource.id, actionId: create.id, effect: "deny", scope: "none" });
            await setUserPermission({ userId: editUser.id, resourceId: resource.id, actionId: del.id, effect: "deny", scope: "none" });

            // noneUser: deny view explicitly so they get 403 on list.
            await setUserPermission({ userId: noneUser.id, resourceId: resource.id, actionId: view.id, effect: "deny", scope: "none" });
            await setUserPermission({ userId: noneUser.id, resourceId: resource.id, actionId: create.id, effect: "deny", scope: "none" });
            await setUserPermission({ userId: noneUser.id, resourceId: resource.id, actionId: update.id, effect: "deny", scope: "none" });
            await setUserPermission({ userId: noneUser.id, resourceId: resource.id, actionId: del.id, effect: "deny", scope: "none" });

            return {
                role,
                branchA,
                branchB,
                viewUser,
                editUser,
                noneUser,
                viewUserPass,
                editUserPass,
                noneUserPass,
            };
        }
    );
    logOk("Seeded test branches/users/permissions for Branch verification");

    // Admin flow: full CRUD should work.
    const adminAuth = await ensureAdminCookie(seeded.branchA.id);
    const adminCookie = adminAuth.cookie;
    if (adminAuth.created) {
        logInfo(`Created local admin user for verification: ${adminAuth.username} / ${adminAuth.password}`);
    }
    const adminCsrf = await getCsrf(adminCookie);
    const createdCode = `VB${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`.slice(0, 20);
    const createRes = await apiCall(
        "/branches",
        "POST",
        adminCsrf.cookie,
        { body: { branch_name: `Branch Verify Created ${createdCode}`, branch_code: createdCode, is_active: true }, csrfToken: adminCsrf.csrfToken }
    );
    assert(createRes.status === 201, `admin create: expected 201, got ${createRes.status}`);
    assert(createRes.json?.success === true, "admin create: expected success=true");
    const createdBranchId = createRes.json?.data?.id;
    assert(typeof createdBranchId === "string" && createdBranchId.length > 0, "admin create: missing branch id");
    logOk("admin can create branch (201)");

    const listRes = await apiCall("/branches?page=1&limit=50&q=Branch%20Verify", "GET", adminCookie);
    assert(listRes.status === 200, `admin list: expected 200, got ${listRes.status}`);
    assert(listRes.json?.success === true, "admin list: expected success=true");
    assert(Array.isArray(listRes.json?.data), "admin list: expected data[]");
    logOk("admin can list branches (200)");

    const updateRes = await apiCall(
        `/branches/${createdBranchId}`,
        "PUT",
        adminCsrf.cookie,
        { body: { phone: "0999999999" }, csrfToken: adminCsrf.csrfToken }
    );
    assert(updateRes.status === 200, `admin update: expected 200, got ${updateRes.status}`);
    assert(updateRes.json?.success === true, "admin update: expected success=true");
    logOk("admin can update branch (200)");

    const delRes = await apiCall(`/branches/${createdBranchId}`, "DELETE", adminCsrf.cookie, { csrfToken: adminCsrf.csrfToken });
    assert(delRes.status === 200, `admin delete: expected 200, got ${delRes.status}`);
    assert(delRes.json?.success === true, "admin delete: expected success=true");
    logOk("admin can delete (soft) branch (200)");

    // View-only user: can view only their own branch, cannot mutate.
    const viewCookie = await login(seeded.viewUser.username, seeded.viewUserPass);
    const viewCsrf = await getCsrf(viewCookie);
    const viewList = await apiCall("/branches?page=1&limit=50", "GET", viewCookie);
    assert(viewList.status === 200, `view-only list: expected 200, got ${viewList.status}`);
    assert(Array.isArray(viewList.json?.data), "view-only list: expected data[]");
    assert(
        viewList.json?.meta?.total === 1,
        `view-only list leaked branches (expected meta.total=1, got ${viewList.json?.meta?.total}). ` +
        `If you are running Postgres as superuser (e.g. DATABASE_USER=postgres), RLS may be bypassed; ` +
        `this project now includes a defense-in-depth filter in BranchController.getAll, but your running server must be restarted to pick it up.`
    );
    assert(viewList.json?.data?.[0]?.id === seeded.branchA.id, "view-only list: expected to see only own branch");
    logOk("non-admin view-only can list only own branch (RLS) (200)");

    const viewOwn = await apiCall(`/branches/${seeded.branchA.id}`, "GET", viewCookie);
    assert(viewOwn.status === 200, `view-only get own: expected 200, got ${viewOwn.status}`);
    logOk("non-admin view-only can get own branch detail (200)");

    const viewOther = await apiCall(`/branches/${seeded.branchB.id}`, "GET", viewCookie);
    assert(viewOther.status === 403, `view-only get other: expected 403, got ${viewOther.status}`);
    logOk("non-admin view-only cannot access other branch detail (403)");

    const viewCreate = await apiCall(
        `/branches`,
        "POST",
        viewCsrf.cookie,
        { body: { branch_name: "Should Fail", branch_code: `FAIL${randomUUID().slice(0, 8)}`.slice(0, 20) }, csrfToken: viewCsrf.csrfToken }
    );
    assert(viewCreate.status === 403, `view-only create: expected 403, got ${viewCreate.status}`);
    logOk("non-admin cannot create branch (403)");

    const viewUpdate = await apiCall(
        `/branches/${seeded.branchA.id}`,
        "PUT",
        viewCsrf.cookie,
        { body: { phone: "0812345678" }, csrfToken: viewCsrf.csrfToken }
    );
    assert(viewUpdate.status === 403, `view-only update: expected 403, got ${viewUpdate.status}`);
    logOk("non-admin cannot update branch (403)");

    const viewDelete = await apiCall(`/branches/${seeded.branchA.id}`, "DELETE", viewCsrf.cookie, { csrfToken: viewCsrf.csrfToken });
    assert(viewDelete.status === 403, `view-only delete: expected 403, got ${viewDelete.status}`);
    logOk("non-admin cannot delete branch (403)");

    // User with update permission but non-admin should still be blocked (Admin-only defense in depth).
    const editCookie = await login(seeded.editUser.username, seeded.editUserPass);
    const editCsrf = await getCsrf(editCookie);
    const editUpdate = await apiCall(
        `/branches/${seeded.branchA.id}`,
        "PUT",
        editCsrf.cookie,
        { body: { phone: "0811111111" }, csrfToken: editCsrf.csrfToken }
    );
    assert(editUpdate.status === 403, `non-admin update w/permission: expected 403, got ${editUpdate.status}`);
    logOk("non-admin with update permission is still blocked from branch update (403)");

    // No-permission user: should be forbidden on list.
    const noneCookie = await login(seeded.noneUser.username, seeded.noneUserPass);
    const noneList = await apiCall("/branches?page=1&limit=20", "GET", noneCookie);
    assert(noneList.status === 403, `no-perm list: expected 403, got ${noneList.status}`);
    logOk("user without view permission cannot list branches (403)");

    await explainBranchSearch();

    logOk("Branch verification completed");
    logInfo(`Created test users (local only):`);
    logInfo(`- ${seeded.viewUser.username} / ${seeded.viewUserPass} (view-only)`);
    logInfo(`- ${seeded.editUser.username} / ${seeded.editUserPass} (view+update permission, but should be blocked by Admin-only routes)`);
    logInfo(`- ${seeded.noneUser.username} / ${seeded.noneUserPass} (no access)`);
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
