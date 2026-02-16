import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { AppDataSource } from "../../src/database/database";
import { runWithDbContext } from "../../src/database/dbContext";
import { Branch } from "../../src/entity/Branch";
import { Users } from "../../src/entity/Users";
import { Roles } from "../../src/entity/Roles";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { UserPermission } from "../../src/entity/UserPermission";
import { Category } from "../../src/entity/pos/Category";
import { ProductsUnit } from "../../src/entity/pos/ProductsUnit";
import { Products } from "../../src/entity/pos/Products";

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
    throw new Error(`PermissionResource not found: ${resourceKey} (run RBAC bootstrap/migrations)`);
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
    assert(health && health.ok, `[FAIL] Server not reachable: ${BASE_URL}`);
    logOk(`Server reachable: ${BASE_URL}`);

    await ensureDb();

    await runWithDbContext({}, async () => {
        const runId = randomUUID().replace(/-/g, "").slice(0, 8);

        // Seed branches
        const branchRepo = AppDataSource.getRepository(Branch);
        const branchA = (await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Products Verify A ${runId}`,
                branch_code: `PPA${runId}`.slice(0, 10),
                is_active: true,
            } as any)
        )) as unknown as Branch;
        const branchB = (await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Products Verify B ${runId}`,
                branch_code: `PPB${runId}`.slice(0, 10),
                is_active: true,
            } as any)
        )) as unknown as Branch;

        // Seed Category + Unit in both branches (needed for Products create)
        const categoryRepo = AppDataSource.getRepository(Category);
        const unitRepo = AppDataSource.getRepository(ProductsUnit);
        const catA = (await categoryRepo.save(
            categoryRepo.create({ category_name: `cat_${runId}`, display_name: `Category ${runId}`, branch_id: branchA.id, is_active: true } as any)
        )) as any as Category;
        const unitA = (await unitRepo.save(
            unitRepo.create({ unit_name: `unit_${runId}`, display_name: `Unit ${runId}`, branch_id: branchA.id, is_active: true } as any)
        )) as any as ProductsUnit;
        const catB = (await categoryRepo.save(
            categoryRepo.create({ category_name: `catB_${runId}`, display_name: `CategoryB ${runId}`, branch_id: branchB.id, is_active: true } as any)
        )) as any as Category;
        const unitB = (await unitRepo.save(
            unitRepo.create({ unit_name: `unitB_${runId}`, display_name: `UnitB ${runId}`, branch_id: branchB.id, is_active: true } as any)
        )) as any as ProductsUnit;

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
        await createUser({ username: mgrViewUsername, password: `View${runId}!`, roleId: managerRole.id, branchId: branchA.id });
        await createUser({ username: mgrEditUsername, password: `Edit${runId}!`, roleId: managerRole.id, branchId: branchA.id });
        await createUser({ username: mgrNoneUsername, password: `None${runId}!`, roleId: managerRole.id, branchId: branchA.id });

        const mgrView = await AppDataSource.getRepository(Users).findOneByOrFail({ username: mgrViewUsername } as any);
        const mgrEdit = await AppDataSource.getRepository(Users).findOneByOrFail({ username: mgrEditUsername } as any);
        const mgrNone = await AppDataSource.getRepository(Users).findOneByOrFail({ username: mgrNoneUsername } as any);

        const resources = await Promise.all([
            ensurePermissionResource("products.page"),
            ensurePermissionResource("products_unit.page"),
            ensurePermissionResource("payment_method.page"),
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

        for (const rk of ["products.page", "products_unit.page", "payment_method.page"]) {
            await allowBranch(mgrView.id, rk, "view");
            await denyNone(mgrView.id, rk, "create");
            await denyNone(mgrView.id, rk, "update");
            await denyNone(mgrView.id, rk, "delete");
        }
        for (const rk of ["products.page", "products_unit.page", "payment_method.page"]) {
            await allowBranch(mgrEdit.id, rk, "view");
            await allowBranch(mgrEdit.id, rk, "create");
            await allowBranch(mgrEdit.id, rk, "update");
            await denyNone(mgrEdit.id, rk, "delete");
        }
        for (const rk of ["products.page", "products_unit.page", "payment_method.page"]) {
            await denyNone(mgrNone.id, rk, "view");
            await denyNone(mgrNone.id, rk, "create");
            await denyNone(mgrNone.id, rk, "update");
            await denyNone(mgrNone.id, rk, "delete");
        }
        logOk("Seeded branches/users/permissions for POS products verification");

        const mgrViewCsrf = await getCsrf(await login(mgrViewUsername, `View${runId}!`));
        const mgrEditCsrf = await getCsrf(await login(mgrEditUsername, `Edit${runId}!`));
        const mgrNoneCsrf = await getCsrf(await login(mgrNoneUsername, `None${runId}!`));

        // Admin must select active branch for non-GET requests
        {
            const { status } = await apiCall("/pos/products", "POST", adminCookieWithCsrf, {
                csrfToken: adminCsrf,
                body: {
                    product_name: `P-${runId}`,
                    display_name: `Product ${runId}`,
                    description: "verify",
                    price: 10,
                    cost: 5,
                    price_delivery: 10,
                    category_id: catA.id,
                    unit_id: unitA.id,
                    is_active: true,
                },
            });
            assert(status === 403, `admin create product without active branch expected 403, got ${status}`);
            logOk("admin cannot create product without active branch selection (403)");
        }

        const adminCookieWithBranch = await switchActiveBranch(adminCookieWithCsrf, adminCsrf, branchA.id);
        logOk("admin switched active branch for POS products operations");

        // Admin create
        {
            const { status } = await apiCall("/pos/productsUnit", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { unit_name: `u-${runId}`, display_name: `U ${runId}`, is_active: true },
            });
            assert(status === 201, `admin create products unit expected 201, got ${status}`);
            logOk("admin can create products unit (201)");
        }
        {
            const { status } = await apiCall("/pos/paymentMethod", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: { payment_method_name: `Cash-${runId}`, display_name: `Cash ${runId}`, is_active: true },
            });
            assert(status === 201, `admin create payment method expected 201, got ${status}`);
            logOk("admin can create payment method (201)");
        }
        {
            const { status } = await apiCall("/pos/products", "POST", adminCookieWithBranch, {
                csrfToken: adminCsrf,
                body: {
                    product_name: `P-${runId}`,
                    display_name: `Product ${runId}`,
                    description: "verify",
                    price: 10,
                    cost: 5,
                    price_delivery: 10,
                    category_id: catA.id,
                    unit_id: unitA.id,
                    is_active: true,
                },
            });
            assert(status === 201, `admin create product expected 201, got ${status}`);
            logOk("admin can create product (201)");
        }

        // Manager view-only: list ok, create forbidden
        {
            const { status } = await apiCall("/pos/products?limit=50", "GET", mgrViewCsrf.cookie);
            assert(status === 200, `view mgr list products expected 200, got ${status}`);
            logOk("manager view-only can list products (200)");
        }
        {
            const { status } = await apiCall("/pos/productsUnit", "POST", mgrViewCsrf.cookie, {
                csrfToken: mgrViewCsrf.csrfToken,
                body: { unit_name: `u2-${runId}`, display_name: `U2 ${runId}`, is_active: true },
            });
            assert(status === 403, `view mgr create products unit expected 403, got ${status}`);
            logOk("manager view-only cannot create products unit (403)");
        }

        // Manager edit: create ok, delete forbidden
        let createdPaymentId = "";
        {
            const res = await apiCall("/pos/paymentMethod", "POST", mgrEditCsrf.cookie, {
                csrfToken: mgrEditCsrf.csrfToken,
                body: { payment_method_name: `PM-${runId}`, display_name: `PM ${runId}`, is_active: true },
            });
            assert(res.status === 201, `edit mgr create payment method expected 201, got ${res.status}`);
            createdPaymentId = res.json?.data?.id || res.json?.id || "";
            assert(createdPaymentId, "edit mgr create payment method: missing id");
            logOk("manager edit can create payment method (201)");
        }
        {
            const res = await apiCall(`/pos/paymentMethod/${createdPaymentId}`, "DELETE", mgrEditCsrf.cookie, {
                csrfToken: mgrEditCsrf.csrfToken,
            });
            assert(res.status === 403, `edit mgr delete payment method expected 403, got ${res.status}`);
            logOk("manager edit cannot delete payment method (403)");
        }

        // None manager: list forbidden
        {
            const { status } = await apiCall("/pos/productsUnit?limit=50", "GET", mgrNoneCsrf.cookie);
            assert(status === 403, `none mgr list products unit expected 403, got ${status}`);
            logOk("manager no-access cannot list products unit (403)");
        }

        // Branch isolation for products: create in branch B via DB and ensure branch A manager can't see
        const productsRepo = AppDataSource.getRepository(Products);
        const createdInB: any = await productsRepo.save(
            productsRepo.create({
                product_name: `PB-${runId}`,
                display_name: `ProductB ${runId}`,
                description: "branch B",
                price: 10,
                cost: 5,
                price_delivery: 10,
                category_id: catB.id,
                unit_id: unitB.id,
                branch_id: branchB.id,
                is_active: true,
            } as any)
        );
        const listA = await apiCall(`/pos/products?limit=200&q=PB-${runId}`, "GET", mgrEditCsrf.cookie);
        assert(listA.status === 200, `branch isolation list products expected 200, got ${listA.status}`);
        const aData = Array.isArray(listA.json?.data) ? listA.json.data : Array.isArray(listA.json) ? listA.json : [];
        assert(!aData.some((p: any) => p.id === createdInB.id), "branch isolation: list leaked branch B product");
        logOk("branch isolation: products list does not leak other-branch product");

        const detailB = await apiCall(`/pos/products/${createdInB.id}`, "GET", mgrEditCsrf.cookie);
        assert(detailB.status === 404 || detailB.status === 403, `branch isolation product detail expected 404/403, got ${detailB.status}`);
        logOk("branch isolation: product detail cannot access other-branch product");

        // Performance: verify trigram indexes exist and can be used (forced plan)
        await AppDataSource.query(`ANALYZE "products"`);
        await AppDataSource.query(`ANALYZE "products_unit"`);
        await AppDataSource.query(`ANALYZE "payment_method"`);

        const idxRows = await AppDataSource.query(
            `SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('products','products_unit','payment_method') AND indexname ILIKE '%trgm%' ORDER BY tablename, indexname`
        );
        const idxNames = idxRows.map((r: any) => `${r.tablename}:${r.indexname}`);
        logInfo(`Found trigram indexes: ${idxNames.join(", ")}`);
        assert(idxNames.some((x: string) => x.includes("products:idx_products_product_name_trgm")), "missing products trigram index");
        assert(idxNames.some((x: string) => x.includes("products_unit:idx_products_unit_unit_name_trgm")), "missing products_unit trigram index");
        assert(idxNames.some((x: string) => x.includes("payment_method:idx_payment_method_name_trgm")), "missing payment_method trigram index");

        const planProducts = await explainWithForcedIndex(
            `SELECT id FROM "products" WHERE product_name ILIKE '%${runId}%' ORDER BY create_date DESC LIMIT 20`
        );
        assert(/idx_products_product_name_trgm/i.test(planProducts), "expected products trigram index usage in forced plan");
        logOk("products search can use trigram index (forced plan)");

        const planUnits = await explainWithForcedIndex(
            `SELECT id FROM "products_unit" WHERE unit_name ILIKE '%${runId}%' ORDER BY create_date DESC LIMIT 20`
        );
        assert(/idx_products_unit_unit_name_trgm/i.test(planUnits), "expected products_unit trigram index usage in forced plan");
        logOk("productsUnit search can use trigram index (forced plan)");

        const planPayment = await explainWithForcedIndex(
            `SELECT id FROM "payment_method" WHERE payment_method_name ILIKE '%${runId}%' ORDER BY create_date DESC LIMIT 20`
        );
        assert(/idx_payment_method_name_trgm/i.test(planPayment), "expected payment_method trigram index usage in forced plan");
        logOk("paymentMethod search can use trigram index (forced plan)");

        logOk("POS products verification completed");
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

