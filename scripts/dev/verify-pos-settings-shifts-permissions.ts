import { AppDataSource } from "../../src/database/database";
import { Branch } from "../../src/entity/Branch";
import { Users } from "../../src/entity/Users";
import { Roles } from "../../src/entity/Roles";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { UserPermission } from "../../src/entity/UserPermission";
import { Shifts, ShiftStatus } from "../../src/entity/pos/Shifts";
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

function makePhoneLike10(): string {
    // Thai phone-like 10 digits, always numeric and reasonably unique per run.
    const n = Math.floor(Math.random() * 100_000_000); // 0..99,999,999
    return `08${String(n).padStart(8, "0")}`;
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
    if (!tokenCookie) throw new Error("Login succeeded but token cookie not found.");
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
    if (!activeBranchCookie) return cookie;
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

async function createUser(params: { username: string; password: string; roleId: string; branchId: string }): Promise<Users> {
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

    const health = await fetch(`${BASE_URL}/health`).catch(() => null as any);
    assert(health && health.ok, `[FAIL] Server not reachable: ${BASE_URL}. Start backend first.`);
    logOk(`Server reachable: ${BASE_URL}`);

    await ensureDb();

    await runWithDbContext({}, async () => {
        const runId = randomUUID().replace(/-/g, "").slice(0, 8);

        const branchRepo = AppDataSource.getRepository(Branch);
        const branchA = (await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Settings Verify A ${runId}`,
                branch_code: `PSA${runId}`.slice(0, 10),
                is_active: true,
            } as any)
        )) as unknown as Branch;
        const branchB = (await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Settings Verify B ${runId}`,
                branch_code: `PSB${runId}`.slice(0, 10),
                is_active: true,
            } as any)
        )) as unknown as Branch;

        const admin = await ensureAdminCookie(branchA.id);
        if (admin.created) logInfo(`Created local admin user for verification: ${admin.username} / ${admin.password}`);
        const { cookie: adminCookieWithCsrf, csrfToken: adminCsrf } = await getCsrf(admin.cookie);

        // Seed managers (branch scoped) with explicit user_permissions.
        const managerRole = await ensureRoleByName("Manager");
        const mgrViewUsername = `pos_view_${runId}`.slice(0, 20);
        const mgrEditUsername = `pos_edit_${runId}`.slice(0, 20);
        const mgrNoneUsername = `pos_none_${runId}`.slice(0, 20);

        const mgrView = await createUser({ username: mgrViewUsername, password: `View${runId}!`, roleId: managerRole.id, branchId: branchA.id });
        const mgrEdit = await createUser({ username: mgrEditUsername, password: `Edit${runId}!`, roleId: managerRole.id, branchId: branchA.id });
        const mgrNone = await createUser({ username: mgrNoneUsername, password: `None${runId}!`, roleId: managerRole.id, branchId: branchA.id });

        const resources = await Promise.all([
            ensurePermissionResource("shop_profile.page"),
            ensurePermissionResource("payment_accounts.page"),
            ensurePermissionResource("shifts.page"),
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

        for (const rk of ["shop_profile.page", "payment_accounts.page", "shifts.page"] as const) {
            await allowBranch(mgrView.id, rk, "view");
            await denyNone(mgrView.id, rk, "create");
            await denyNone(mgrView.id, rk, "update");
            await denyNone(mgrView.id, rk, "delete");
        }

        for (const rk of ["shop_profile.page", "payment_accounts.page", "shifts.page"] as const) {
            await allowBranch(mgrEdit.id, rk, "view");
            await allowBranch(mgrEdit.id, rk, "create");
            await allowBranch(mgrEdit.id, rk, "update");
            await denyNone(mgrEdit.id, rk, "delete");
        }

        for (const rk of ["shop_profile.page", "payment_accounts.page", "shifts.page"] as const) {
            await denyNone(mgrNone.id, rk, "view");
            await denyNone(mgrNone.id, rk, "create");
            await denyNone(mgrNone.id, rk, "update");
            await denyNone(mgrNone.id, rk, "delete");
        }

        logOk("Seeded branches/users/permissions for POS settings+shifts verification");

        const mgrViewCookie = await login(mgrViewUsername, `View${runId}!`);
        const mgrEditCookie = await login(mgrEditUsername, `Edit${runId}!`);
        const mgrNoneCookie = await login(mgrNoneUsername, `None${runId}!`);

        const mgrViewCsrf = await getCsrf(mgrViewCookie);
        const mgrEditCsrf = await getCsrf(mgrEditCookie);
        const mgrNoneCsrf = await getCsrf(mgrNoneCookie);

        // Admin strict branch required now (all methods).
        {
            const { status } = await apiCall("/pos/shifts/open", "POST", adminCookieWithCsrf, {
                csrfToken: adminCsrf,
                body: { start_amount: 100 },
            });
            assert(status === 403, `admin open shift without active branch expected 403, got ${status}`);
            logOk("admin cannot open shift without active branch selection (403)");
        }

        const adminCookieWithBranch = await switchActiveBranch(adminCookieWithCsrf, adminCsrf, branchA.id);
        logOk("admin switched active branch for POS settings+shifts operations");

        // Admin can update shop profile (PUT)
        {
            const { status } = await apiCall("/pos/shopProfile", "PUT", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { shop_name: `Shop ${runId}` },
            });
            assert(status === 200, `admin update shop profile expected 200, got ${status}`);
            logOk("admin can update shop profile (200)");
        }

        // Admin can create payment account
        let adminAccountId = "";
        {
            const accountNumber = makePhoneLike10();
            const res = await apiCall("/pos/payment-accounts/accounts", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: {
                    account_name: `Admin PP ${runId}`,
                    account_number: accountNumber,
                    account_type: "PromptPay",
                    phone: "0800000000",
                    address: "verify payment accounts",
                    is_active: true,
                },
            });
            assert(res.status === 201, `admin create payment account expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
            adminAccountId = res.json?.data?.id || res.json?.id || "";
            assert(adminAccountId, "admin create payment account: missing id");
            logOk("admin can create payment account (201)");
        }

        // Admin open+close shift
        let openedShiftId = "";
        {
            const res = await apiCall("/pos/shifts/open", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { start_amount: 100 },
            });
            assert(res.status === 201, `admin open shift expected 201, got ${res.status}`);
            openedShiftId = res.json?.data?.id || res.json?.id || "";
            assert(openedShiftId, "admin open shift: missing id");
            logOk("admin can open shift (201)");
        }
        {
            const res = await apiCall("/pos/shifts/current", "GET", adminCookieWithBranch);
            assert(res.status === 200, `admin get current shift expected 200, got ${res.status}`);
            const id = res.json?.data?.id || res.json?.id || "";
            assert(id === openedShiftId, "admin current shift mismatch");
            logOk("admin can get current shift (200)");
        }
        {
            const res = await apiCall("/pos/shifts/close", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { end_amount: 100 },
            });
            assert(res.status === 200, `admin close shift expected 200, got ${res.status}`);
            logOk("admin can close shift (200)");
        }
        {
            const res = await apiCall("/pos/shifts/history?limit=20", "GET", adminCookieWithBranch);
            assert(res.status === 200, `admin shift history expected 200, got ${res.status}`);
            logOk("admin can view shift history (200)");
        }

        // Manager view-only
        {
            const res = await apiCall("/pos/payment-accounts/accounts", "GET", mgrViewCsrf.cookie);
            assert(res.status === 200, `view mgr list payment accounts expected 200, got ${res.status}`);
            logOk("manager view-only can list payment accounts (200)");
        }
        {
            const res = await apiCall("/pos/payment-accounts/accounts", "POST", mgrViewCsrf.cookie, {
                csrfToken: mgrViewCsrf.csrfToken,
                body: { account_name: "x", account_number: "0800000001", account_type: "PromptPay" },
            });
            assert(res.status === 403, `view mgr create payment account expected 403, got ${res.status}`);
            logOk("manager view-only cannot create payment account (403)");
        }
        {
            const res = await apiCall("/pos/shopProfile", "PUT", mgrViewCsrf.cookie, {
                csrfToken: mgrViewCsrf.csrfToken,
                body: { shop_name: `Denied ${runId}` },
            });
            assert(res.status === 403, `view mgr update shop profile expected 403, got ${res.status}`);
            logOk("manager view-only cannot update shop profile (403)");
        }
        {
            const res = await apiCall("/pos/shifts/current", "GET", mgrViewCsrf.cookie);
            assert(res.status === 200, `view mgr current shift expected 200, got ${res.status}`);
            logOk("manager view-only can view current shift (200)");
        }
        {
            const res = await apiCall("/pos/shifts/open", "POST", mgrViewCsrf.cookie, {
                csrfToken: mgrViewCsrf.csrfToken,
                body: { start_amount: 50 },
            });
            assert(res.status === 403, `view mgr open shift expected 403, got ${res.status}`);
            logOk("manager view-only cannot open shift (403)");
        }

        // Manager edit: create allowed, delete forbidden
        let mgrAccountId = "";
        {
            const accountNumber = makePhoneLike10();
            const res = await apiCall("/pos/payment-accounts/accounts", "POST", mgrEditCsrf.cookie, {
                csrfToken: mgrEditCsrf.csrfToken,
                body: {
                    account_name: `Mgr PP ${runId}`,
                    account_number: accountNumber,
                    account_type: "PromptPay",
                    is_active: false,
                },
            });
            assert(res.status === 201, `edit mgr create payment account expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
            mgrAccountId = res.json?.data?.id || res.json?.id || "";
            assert(mgrAccountId, "edit mgr create payment account: missing id");
            logOk("manager edit can create payment account (201)");
        }
        {
            const res = await apiCall(`/pos/payment-accounts/accounts/${mgrAccountId}`, "DELETE", mgrEditCsrf.cookie, {
                csrfToken: mgrEditCsrf.csrfToken,
            });
            assert(res.status === 403, `edit mgr delete payment account expected 403, got ${res.status}`);
            logOk("manager edit cannot delete payment account (403)");
        }

        // Manager none: list forbidden
        {
            const res = await apiCall("/pos/payment-accounts/accounts", "GET", mgrNoneCsrf.cookie);
            assert(res.status === 403, `none mgr list payment accounts expected 403, got ${res.status}`);
            logOk("manager no-access cannot list payment accounts (403)");
        }

        // Branch isolation (shifts history should not leak other branch)
        const otherUserB = await createUser({
            username: `shiftB_${runId}`.slice(0, 20),
            password: `B${runId}!`,
            roleId: managerRole.id,
            branchId: branchB.id,
        });
        const shiftsRepo = AppDataSource.getRepository(Shifts);
        await shiftsRepo.save(
            shiftsRepo.create({
                user_id: otherUserB.id,
                opened_by_user_id: otherUserB.id,
                branch_id: branchB.id,
                start_amount: 0,
                end_amount: 0,
                expected_amount: 0,
                diff_amount: 0,
                status: ShiftStatus.CLOSED,
                open_time: new Date(),
                close_time: new Date(),
            } as any)
        );

        const leakCheck = await apiCall(`/pos/shifts/history?limit=50&q=shiftB_${runId}`, "GET", mgrEditCsrf.cookie);
        assert(leakCheck.status === 200, `branch isolation history expected 200, got ${leakCheck.status}`);
        const rows = Array.isArray(leakCheck.json?.data) ? leakCheck.json.data : [];
        assert(rows.length === 0, "branch isolation: shifts history leaked other-branch data");
        logOk("branch isolation: shifts history does not leak other branch");

        // Performance: verify indexes exist and can be used (forced plan).
        await AppDataSource.query(`ANALYZE "shifts"`);
        await AppDataSource.query(`ANALYZE "shop_payment_account"`);

        const idxRows = await AppDataSource.query(
            `SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('shifts','shop_payment_account') AND indexname ILIKE '%idx_%' ORDER BY tablename, indexname`
        );
        const idxNames = idxRows.map((r: any) => `${r.tablename}:${r.indexname}`);
        logInfo(`Indexes: ${idxNames.filter((x: string) => /shifts:idx_shifts_|shop_payment_account:idx_shop_payment_account_/i.test(x)).join(", ")}`);

        assert(idxNames.some((x: string) => x.includes("shifts:idx_shifts_branch_open_time_desc")), "missing shifts branch_open_time index");
        assert(idxNames.some((x: string) => x.includes("shifts:idx_shifts_branch_status_open_time_desc")), "missing shifts branch_status_open_time index");
        assert(idxNames.some((x: string) => x.includes("shop_payment_account:idx_shop_payment_account_shop_branch_active_created_desc")), "missing payment accounts performance index");

        const planHistory = await explainWithForcedIndex(
            `SELECT id FROM "shifts" WHERE branch_id = '${branchA.id}' ORDER BY open_time DESC LIMIT 20`
        );
        assert(/idx_shifts_branch_open_time_desc/i.test(planHistory), "expected shifts branch_open_time index usage in forced plan");
        logOk("shifts history list can use branch_open_time index (forced plan)");

        const planHistoryStatus = await explainWithForcedIndex(
            `SELECT id FROM "shifts" WHERE branch_id = '${branchA.id}' AND status = 'CLOSED' ORDER BY open_time DESC LIMIT 20`
        );
        assert(/idx_shifts_branch_status_open_time_desc/i.test(planHistoryStatus), "expected shifts branch_status_open_time index usage in forced plan");
        logOk("shifts history list (status filter) can use branch_status_open_time index (forced plan)");

        // Cleanup not required for local verification scripts.
        logOk("POS settings+shifts verification completed");
        logInfo("Created test users (local only):");
        logInfo(`- ${mgrViewUsername} / View${runId}! (view-only)`);
        logInfo(`- ${mgrEditUsername} / Edit${runId}! (create+update, no delete)`);
        logInfo(`- ${mgrNoneUsername} / None${runId}! (no access)`);
        logInfo(`- shiftB_${runId} / B${runId}! (branch B user)`);
    });
}

main().catch((err) => {
    process.stderr.write(`[FAIL] ${err?.stack || err?.message || String(err)}\n`);
    process.exitCode = 1;
});
