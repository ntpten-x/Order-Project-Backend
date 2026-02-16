import { AppDataSource } from "../../src/database/database";
import { Branch } from "../../src/entity/Branch";
import { Users } from "../../src/entity/Users";
import { Roles } from "../../src/entity/Roles";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { UserPermission } from "../../src/entity/UserPermission";
import { Tables } from "../../src/entity/pos/Tables";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { runWithDbContext } from "../../src/database/dbContext";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ALLOW_NONLOCAL_SEED = process.env.ALLOW_NONLOCAL_SEED === "1";

type Effect = "allow" | "deny";
type Scope = "none" | "own" | "branch" | "all";
type ActionKey = "view" | "create" | "update" | "delete";

function assert(condition: any, message: string) {
    if (!condition) throw new Error(message);
}

function logOk(msg: string) {
    process.stdout.write(`[OK] ${msg}\n`);
}

function logInfo(msg: string) {
    process.stdout.write(`[INFO] ${msg}\n`);
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
): Promise<{ status: number; json: any; setCookie: string | null }> {
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
    return { status: res.status, json, setCookie: res.headers.get("set-cookie") };
}

async function switchActiveBranch(cookie: string, csrfToken: string, branchId: string | null): Promise<string> {
    const res = await apiCall("/auth/switch-branch", "POST", cookie, {
        csrfToken,
        body: { branch_id: branchId },
    });
    assert(res.status === 200, `switch-branch expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);

    const activeBranchCookie = pickCookie(res.setCookie, "active_branch_id");
    if (!activeBranchCookie) {
        // If switching branch_id=null, server clears cookie so set-cookie might not include it.
        return cookie;
    }
    return `${cookie}; ${activeBranchCookie}`;
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

async function ensurePermissionResource(resourceKey: string): Promise<PermissionResource> {
    const repo = AppDataSource.getRepository(PermissionResource);
    const found = await repo.findOne({ where: { resource_key: resourceKey } as any });
    if (found) return found;
    throw new Error(`PermissionResource not found: ${resourceKey}`);
}

async function ensurePermissionAction(actionKey: ActionKey): Promise<PermissionAction> {
    const repo = AppDataSource.getRepository(PermissionAction);
    const found = await repo.findOne({ where: { action_key: actionKey } as any });
    if (found) return found;
    throw new Error(`PermissionAction not found: ${actionKey}`);
}

async function upsertUserPermission(params: {
    userId: string;
    resourceId: string;
    actionId: string;
    effect: Effect;
    scope: Scope;
}) {
    const repo = AppDataSource.getRepository(UserPermission);
    await repo.delete({ user_id: params.userId, resource_id: params.resourceId, action_id: params.actionId } as any);
    const created = repo.create({
        user_id: params.userId,
        resource_id: params.resourceId,
        action_id: params.actionId,
        effect: params.effect,
        scope: params.scope,
    } as any);
    await repo.save(created as any);
}

function safeHost(host: string | undefined): string {
    return String(host || "").trim().toLowerCase();
}

function refuseNonLocalSeed() {
    const host = safeHost(process.env.DATABASE_HOST);
    if (!host) return;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal && !ALLOW_NONLOCAL_SEED) {
        throw new Error(
            `Refusing to seed verification data on non-local DATABASE_HOST=${process.env.DATABASE_HOST}. Set ALLOW_NONLOCAL_SEED=1 to override (not recommended).`
        );
    }
}

async function createUser(params: {
    username: string;
    password: string;
    roleId: string;
    branchId: string;
}): Promise<Users> {
    const repo = AppDataSource.getRepository(Users);
    const passwordHash = await bcrypt.hash(params.password, 10);
    const created = repo.create({
        username: params.username,
        password: passwordHash,
        roles_id: params.roleId,
        branch_id: params.branchId,
        is_use: true,
        is_active: false,
    });
    return (await repo.save(created as any)) as Users;
}

async function ensureAdminCookie(branchIdForNewAdmin: string): Promise<{ cookie: string; username: string; password: string; created: boolean }> {
    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
        try {
            const cookie = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
            return { cookie, username: ADMIN_USERNAME, password: ADMIN_PASSWORD, created: false };
        } catch {
            // fall through
        }
    }

    const adminRole = await ensureRoleByName("Admin");
    const runId = randomUUID().replace(/-/g, "").slice(0, 8);
    const username = `admin_pos_${runId}`.slice(0, 20);
    const password = `Admin${runId}!`;
    await createUser({ username, password, roleId: adminRole.id, branchId: branchIdForNewAdmin });
    const cookie = await login(username, password);
    return { cookie, username, password, created: true };
}

async function explain(sql: string, params: any[] = []): Promise<string> {
    const rows = (await AppDataSource.query(sql, params)) as Array<{ "QUERY PLAN"?: string }>;
    return rows.map((r) => r["QUERY PLAN"] || Object.values(r)[0]).join("\n");
}

async function explainWithForcedIndex(sql: string): Promise<string> {
    await AppDataSource.query(`SET enable_seqscan=off`);
    try {
        return await explain(`EXPLAIN ${sql}`);
    } finally {
        await AppDataSource.query(`RESET enable_seqscan`);
    }
}

async function main() {
    refuseNonLocalSeed();

    // quick health check
    const health = await fetch(`${BASE_URL}/health`).catch(() => null as any);
    assert(
        health && health.ok,
        `[FAIL] Server not reachable: ${BASE_URL}. Start backend first, e.g. in another terminal: cd Order-Project-Backend; node dist/app.js (or npm run dev).`
    );
    logOk(`Server reachable: ${BASE_URL}`);

    await ensureDb();

    await runWithDbContext({}, async () => {
        const runId = randomUUID().replace(/-/g, "").slice(0, 8);

        // Seed branches
        const branchRepo = AppDataSource.getRepository(Branch);
        const branchA = (await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Verify A ${runId}`,
                branch_code: `PVA${runId}`.slice(0, 10),
                is_active: true,
            } as any)
        )) as unknown as Branch;
        const branchB = (await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Verify B ${runId}`,
                branch_code: `PVB${runId}`.slice(0, 10),
                is_active: true,
            } as any)
        )) as unknown as Branch;

        // Ensure admin cookie
        const admin = await ensureAdminCookie(branchA.id);
        if (admin.created) {
            logInfo(`Created local admin user for verification: ${admin.username} / ${admin.password}`);
        }

        const { cookie: adminCookieWithCsrf, csrfToken: adminCsrf } = await getCsrf(admin.cookie);

        // Seed Manager users (branch scoped) with explicit user_permissions (allow/deny)
        const managerRole = await ensureRoleByName("Manager");
        const mgrViewUsername = `pos_view_${runId}`.slice(0, 20);
        const mgrEditUsername = `pos_edit_${runId}`.slice(0, 20);
        const mgrNoneUsername = `pos_none_${runId}`.slice(0, 20);

        const mgrView = await createUser({ username: mgrViewUsername, password: `View${runId}!`, roleId: managerRole.id, branchId: branchA.id });
        const mgrEdit = await createUser({ username: mgrEditUsername, password: `Edit${runId}!`, roleId: managerRole.id, branchId: branchA.id });
        const mgrNone = await createUser({ username: mgrNoneUsername, password: `None${runId}!`, roleId: managerRole.id, branchId: branchA.id });

        // Apply permissions
        const resources = await Promise.all([
            ensurePermissionResource("tables.page"),
            ensurePermissionResource("delivery.page"),
            ensurePermissionResource("discounts.page"),
        ]);
        const actions = await Promise.all([
            ensurePermissionAction("view"),
            ensurePermissionAction("create"),
            ensurePermissionAction("update"),
            ensurePermissionAction("delete"),
        ]);

        const byKey: Record<string, PermissionResource> = Object.fromEntries(resources.map((r) => [r.resource_key, r]));
        const byAction = Object.fromEntries(actions.map((a: any) => [a.action_key as ActionKey, a])) as Record<ActionKey, PermissionAction>;

        const allowBranch = async (userId: string, resourceKey: string, actionKey: ActionKey) => {
            await upsertUserPermission({
                userId,
                resourceId: byKey[resourceKey].id,
                actionId: byAction[actionKey].id,
                effect: "allow",
                scope: "branch",
            });
        };

        const denyNone = async (userId: string, resourceKey: string, actionKey: ActionKey) => {
            await upsertUserPermission({
                userId,
                resourceId: byKey[resourceKey].id,
                actionId: byAction[actionKey].id,
                effect: "deny",
                scope: "none",
            });
        };

        // View-only manager: allow view; deny create/update/delete
        for (const rk of ["tables.page", "delivery.page", "discounts.page"]) {
            await allowBranch(mgrView.id, rk, "view");
            await denyNone(mgrView.id, rk, "create");
            await denyNone(mgrView.id, rk, "update");
            await denyNone(mgrView.id, rk, "delete");
        }

        // Edit manager: allow view/create/update; deny delete
        for (const rk of ["tables.page", "delivery.page", "discounts.page"]) {
            await allowBranch(mgrEdit.id, rk, "view");
            await allowBranch(mgrEdit.id, rk, "create");
            await allowBranch(mgrEdit.id, rk, "update");
            await denyNone(mgrEdit.id, rk, "delete");
        }

        // None manager: deny view/create/update/delete
        for (const rk of ["tables.page", "delivery.page", "discounts.page"]) {
            await denyNone(mgrNone.id, rk, "view");
            await denyNone(mgrNone.id, rk, "create");
            await denyNone(mgrNone.id, rk, "update");
            await denyNone(mgrNone.id, rk, "delete");
        }

        logOk("Seeded branches/users/permissions for POS master verification");

        const mgrViewCookie = await login(mgrViewUsername, `View${runId}!`);
        const mgrEditCookie = await login(mgrEditUsername, `Edit${runId}!`);
        const mgrNoneCookie = await login(mgrNoneUsername, `None${runId}!`);

        const mgrViewCsrf = await getCsrf(mgrViewCookie);
        const mgrEditCsrf = await getCsrf(mgrEditCookie);
        const mgrNoneCsrf = await getCsrf(mgrNoneCookie);

        // Admin can create for all modules
        {
            const { status } = await apiCall("/pos/tables", "POST", adminCookieWithCsrf, {
                csrfToken: adminCsrf,
                body: { table_name: `T-${runId}`, status: "Available", is_active: true },
            });
            // Admin must select an active branch for non-GET requests on branch-scoped POS masters.
            assert(status === 403, `admin create table without active branch expected 403, got ${status}`);
            logOk("admin cannot create table without active branch selection (403)");
        }

        const adminCookieWithBranch = await switchActiveBranch(adminCookieWithCsrf, adminCsrf, branchA.id);
        logOk("admin switched active branch for POS master operations");

        {
            const { status } = await apiCall("/pos/tables", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { table_name: `T-${runId}`, status: "Available", is_active: true },
            });
            assert(status === 201, `admin create table expected 201, got ${status}`);
            logOk("admin can create table (201)");
        }
        {
            const { status } = await apiCall("/pos/delivery", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { delivery_name: `D-${runId}`, delivery_prefix: "DV", is_active: true },
            });
            assert(status === 201, `admin create delivery expected 201, got ${status}`);
            logOk("admin can create delivery (201)");
        }
        {
            const { status } = await apiCall("/pos/discounts", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { discount_name: `DISC_${runId}`, display_name: `Discount ${runId}`, discount_type: "Fixed", discount_amount: 10, is_active: true },
            });
            assert(status === 201, `admin create discount expected 201, got ${status}`);
            logOk("admin can create discount (201)");
        }

        // View-only manager: list ok, create forbidden
        {
            const { status } = await apiCall("/pos/tables?limit=50", "GET", mgrViewCsrf.cookie);
            assert(status === 200, `view mgr list tables expected 200, got ${status}`);
            logOk("manager view-only can list tables (200)");
        }
        {
            const { status } = await apiCall("/pos/tables", "POST", mgrViewCsrf.cookie, {
                csrfToken: mgrViewCsrf.csrfToken,
                body: { table_name: `T2-${runId}`, status: "Available", is_active: true },
            });
            assert(status === 403, `view mgr create table expected 403, got ${status}`);
            logOk("manager view-only cannot create table (403)");
        }

        // Edit manager: create ok, delete forbidden
        let createdTableId = "";
        {
            const res = await apiCall("/pos/tables", "POST", mgrEditCsrf.cookie, {
                csrfToken: mgrEditCsrf.csrfToken,
                body: { table_name: `TM-${runId}`, status: "Available", is_active: true },
            });
            assert(res.status === 201, `edit mgr create table expected 201, got ${res.status}`);
            createdTableId = res.json?.data?.id || res.json?.id || "";
            assert(createdTableId, "edit mgr create table: missing id");
            logOk("manager edit can create table (201)");
        }
        {
            const res = await apiCall(`/pos/tables/${createdTableId}`, "DELETE", mgrEditCsrf.cookie, {
                csrfToken: mgrEditCsrf.csrfToken,
            });
            assert(res.status === 403, `edit mgr delete table expected 403, got ${res.status}`);
            logOk("manager edit cannot delete table (403)");
        }

        // None manager: list forbidden
        {
            const { status } = await apiCall("/pos/delivery?limit=50", "GET", mgrNoneCsrf.cookie);
            assert(status === 403, `none mgr list delivery expected 403, got ${status}`);
            logOk("manager no-access cannot list delivery (403)");
        }

        // Branch isolation: branch A manager cannot see branch B data
        // Create a table in branch B via direct DB and check list count doesn't include it for branch A user.
        const tablesRepo = AppDataSource.getRepository(Tables);
        const createdInB: any = await tablesRepo.save(
            tablesRepo.create({ table_name: `TB-${runId}`, branch_id: branchB.id, status: "Available", is_active: true } as any)
        );
        const listA = await apiCall("/pos/tables?limit=200&q=TB-", "GET", mgrEditCsrf.cookie);
        assert(listA.status === 200, `branch isolation list expected 200, got ${listA.status}`);
        const aData = Array.isArray(listA.json?.data) ? listA.json.data : Array.isArray(listA.json) ? listA.json : [];
        assert(!aData.some((t: any) => t.id === createdInB.id), "branch isolation: list leaked branch B table");
        logOk("branch isolation: list does not leak other-branch table");

        const detailB = await apiCall(`/pos/tables/${createdInB.id}`, "GET", mgrEditCsrf.cookie);
        assert(detailB.status === 404 || detailB.status === 403, `branch isolation detail expected 404/403, got ${detailB.status}`);
        logOk("branch isolation: detail cannot access other-branch table");

        // Performance: verify trigram indexes exist and can be used (forced plan).
        await AppDataSource.query(`ANALYZE "tables"`);
        await AppDataSource.query(`ANALYZE "delivery"`);
        await AppDataSource.query(`ANALYZE "discounts"`);

        const idxRows = await AppDataSource.query(
            `SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('tables','delivery','discounts') AND indexname ILIKE '%trgm%' ORDER BY tablename, indexname`
        );
        const idxNames = idxRows.map((r: any) => `${r.tablename}:${r.indexname}`);
        logInfo(`Found trigram indexes: ${idxNames.join(", ")}`);
        assert(idxNames.some((x: string) => x.includes("tables:idx_tables_table_name_trgm")), "missing tables trigram index");
        assert(idxNames.some((x: string) => x.includes("delivery:idx_delivery_delivery_name_trgm")), "missing delivery trigram index");
        assert(idxNames.some((x: string) => x.includes("discounts:idx_discounts_discount_name_trgm")), "missing discounts trigram index");

        const planTable = await explainWithForcedIndex(
            `SELECT id FROM "tables" WHERE table_name ILIKE '%${runId}%' ORDER BY create_date DESC LIMIT 20`
        );
        assert(/idx_tables_table_name_trgm/i.test(planTable), "expected tables trigram index usage in forced plan");
        logOk("tables search can use trigram index (forced plan)");

        const planDelivery = await explainWithForcedIndex(
            `SELECT id FROM "delivery" WHERE delivery_name ILIKE '%${runId}%' ORDER BY create_date DESC LIMIT 20`
        );
        assert(/idx_delivery_delivery_name_trgm/i.test(planDelivery), "expected delivery trigram index usage in forced plan");
        logOk("delivery search can use trigram index (forced plan)");

        const planDiscounts = await explainWithForcedIndex(
            `SELECT id FROM "discounts" WHERE (discount_name ILIKE '%${runId}%' OR display_name ILIKE '%${runId}%' OR description ILIKE '%${runId}%') ORDER BY create_date DESC LIMIT 20`
        );
        assert(/idx_discounts_.*_trgm/i.test(planDiscounts), "expected discounts trigram index usage in forced plan");
        logOk("discounts search can use trigram indexes (forced plan)");

        logOk("POS master verification completed");
        logInfo("Created test users (local only):");
        logInfo(`- ${mgrViewUsername} / View${runId}! (view-only)`);
        logInfo(`- ${mgrEditUsername} / Edit${runId}! (create+update, no delete)`);
        logInfo(`- ${mgrNoneUsername} / None${runId}! (no access)`);
    });
}

main().catch((err) => {
    process.stderr.write(`[FAIL] ${err?.stack || err?.message || String(err)}\n`);
    process.exitCode = 1;
});
