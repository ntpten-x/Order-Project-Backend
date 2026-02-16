import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { AppDataSource } from "../../src/database/database";
import { runWithDbContext } from "../../src/database/dbContext";
import { Branch } from "../../src/entity/Branch";
import { Roles } from "../../src/entity/Roles";
import { Users } from "../../src/entity/Users";
import { PermissionAction } from "../../src/entity/PermissionAction";
import { PermissionResource } from "../../src/entity/PermissionResource";
import { UserPermission } from "../../src/entity/UserPermission";
import { Category } from "../../src/entity/pos/Category";
import { Products } from "../../src/entity/pos/Products";
import { ProductsUnit } from "../../src/entity/pos/ProductsUnit";
import { Tables, TableStatus } from "../../src/entity/pos/Tables";
import { Delivery } from "../../src/entity/pos/Delivery";
import { PaymentMethod } from "../../src/entity/pos/PaymentMethod";
import { OrderStatus, OrderType } from "../../src/entity/pos/OrderEnums";
import { SalesOrder } from "../../src/entity/pos/SalesOrder";
import { SalesOrderItem } from "../../src/entity/pos/SalesOrderItem";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
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

async function jsonFetch(
    path: string,
    init: RequestInit & { cookie?: string; csrfToken?: string } = {}
): Promise<{ status: number; json: any; headers: Headers }> {
    const { cookie, csrfToken, ...rest } = init;
    const res = await fetch(`${BASE_URL}${path}`, {
        redirect: "manual",
        ...rest,
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            ...(cookie ? { cookie } : {}),
            ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
            ...(rest.headers || {}),
        },
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json, headers: res.headers };
}

async function login(username: string, password: string): Promise<string> {
    const res = await jsonFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.json)}`);
    }
    const setCookie = res.headers.get("set-cookie");
    const token = pickCookie(setCookie, "token");
    assert(token, "Login did not return token cookie");
    return token;
}

async function getCsrf(cookie: string): Promise<{ cookie: string; csrfToken: string }> {
    const res = await fetch(`${BASE_URL}/csrf-token`, {
        method: "GET",
        redirect: "manual",
        headers: {
            accept: "application/json",
            ...(cookie ? { cookie } : {}),
        },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || typeof json?.csrfToken !== "string" || !json.csrfToken) {
        throw new Error(`Failed to fetch CSRF token (${res.status}): ${JSON.stringify(json)}`);
    }
    const setCookie = res.headers.get("set-cookie");
    const csrfCookie = pickCookie(setCookie, "_csrf");
    const combined = csrfCookie ? `${cookie}; ${csrfCookie}` : cookie;
    return { cookie: combined, csrfToken: json.csrfToken };
}

async function switchBranch(cookie: string, csrfToken: string, branchId: string): Promise<string> {
    const res = await jsonFetch("/auth/switch-branch", {
        method: "POST",
        cookie,
        csrfToken,
        body: JSON.stringify({ branch_id: branchId }),
    });
    assert(res.status === 200, `switch branch expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
    const setCookie = res.headers.get("set-cookie");
    const branchCookie = pickCookie(setCookie, "active_branch_id");
    assert(branchCookie, "switch branch did not return active_branch_id cookie");
    return `${cookie}; ${branchCookie}`;
}

async function main() {
    refuseNonLocalSeed();
    await ensureDb();

    // Verify server reachable
    const health = await fetch(BASE_URL, { redirect: "manual" }).catch(() => null as any);
    assert(health && (health.status === 200 || health.status === 302 || health.status === 404), `Server unreachable: ${BASE_URL}`);
    logOk(`Server reachable: ${BASE_URL}`);

    const runId = randomUUID().slice(0, 8);

    await runWithDbContext({ branchId: "", userId: "", role: "", isAdmin: false }, async () => {
        const branchRepo = AppDataSource.getRepository(Branch);
        const roleRepo = AppDataSource.getRepository(Roles);
        const userRepo = AppDataSource.getRepository(Users);
        const prRepo = AppDataSource.getRepository(PermissionResource);
        const paRepo = AppDataSource.getRepository(PermissionAction);
        const upRepo = AppDataSource.getRepository(UserPermission);

        const catRepo = AppDataSource.getRepository(Category);
        const unitRepo = AppDataSource.getRepository(ProductsUnit);
        const prodRepo = AppDataSource.getRepository(Products);
        const tableRepo = AppDataSource.getRepository(Tables);
        const deliveryRepo = AppDataSource.getRepository(Delivery);
        const pmRepo = AppDataSource.getRepository(PaymentMethod);

        const branchA = await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Orders Verify A ${runId}`,
                branch_code: `POA${runId}`,
                is_active: true,
            } as any)
        );
        const branchB = await branchRepo.save(
            branchRepo.create({
                branch_name: `POS Orders Verify B ${runId}`,
                branch_code: `POB${runId}`,
                is_active: true,
            } as any)
        );

        const adminRole = await roleRepo.findOne({ where: { roles_name: "Admin" } });
        const managerRole = await roleRepo.findOne({ where: { roles_name: "Manager" } });
        assert(adminRole, "Missing role Admin");
        assert(managerRole, "Missing role Manager");

        const adminUsername = `admin_pos_${runId}`;
        const adminPassword = `Admin${runId}!`;
        const adminHash = await bcrypt.hash(adminPassword, 10);
        const admin = await userRepo.save(
            userRepo.create({
                username: adminUsername,
                password: adminHash,
                roles_id: (adminRole as any).id,
                is_use: true,
                is_active: false,
                branch_id: (branchA as any).id,
            } as any)
        );
        logInfo(`Created local admin user for verification: ${adminUsername} / ${adminPassword}`);

        const viewUser = await userRepo.save(
            userRepo.create({
                username: `pos_view_${runId}`,
                password: await bcrypt.hash(`View${runId}!`, 10),
                roles_id: (managerRole as any).id,
                is_use: true,
                is_active: false,
                branch_id: (branchA as any).id,
            } as any)
        );
        const editUser = await userRepo.save(
            userRepo.create({
                username: `pos_edit_${runId}`,
                password: await bcrypt.hash(`Edit${runId}!`, 10),
                roles_id: (managerRole as any).id,
                is_use: true,
                is_active: false,
                branch_id: (branchA as any).id,
            } as any)
        );
        const noneUser = await userRepo.save(
            userRepo.create({
                username: `pos_none_${runId}`,
                password: await bcrypt.hash(`None${runId}!`, 10),
                roles_id: (managerRole as any).id,
                is_use: true,
                is_active: false,
                branch_id: (branchA as any).id,
            } as any)
        );

        const resources = {
            orders: await prRepo.findOne({ where: { resource_key: "orders.page" } }),
            payments: await prRepo.findOne({ where: { resource_key: "payments.page" } }),
            queue: await prRepo.findOne({ where: { resource_key: "queue.page" } }),
        };
        assert(resources.orders, "Missing permission resource: orders.page");
        assert(resources.payments, "Missing permission resource: payments.page");
        assert(resources.queue, "Missing permission resource: queue.page");

        const actions = {
            view: await paRepo.findOne({ where: { action_key: "view" } }),
            create: await paRepo.findOne({ where: { action_key: "create" } }),
            update: await paRepo.findOne({ where: { action_key: "update" } }),
            delete: await paRepo.findOne({ where: { action_key: "delete" } }),
        };
        assert(actions.view && actions.create && actions.update && actions.delete, "Missing permission actions");

        async function setUserPerm(
            userId: string,
            resourceId: string,
            actionId: string,
            effect: Effect,
            scope: Scope
        ) {
            await upRepo.delete({ user_id: userId as any, resource_id: resourceId as any, action_id: actionId as any } as any);
            await upRepo.save(
                upRepo.create({
                    user_id: userId as any,
                    resource_id: resourceId as any,
                    action_id: actionId as any,
                    effect,
                    scope,
                } as any)
            );
        }

        // View-only manager: can view orders/queue, cannot create/update/delete, cannot create payments.
        for (const r of [resources.orders!, resources.queue!, resources.payments!]) {
            await setUserPerm((viewUser as any).id, (r as any).id, (actions.view as any).id, "allow", "branch");
            await setUserPerm((viewUser as any).id, (r as any).id, (actions.create as any).id, "deny", "none");
            await setUserPerm((viewUser as any).id, (r as any).id, (actions.update as any).id, "deny", "none");
            await setUserPerm((viewUser as any).id, (r as any).id, (actions.delete as any).id, "deny", "none");
        }

        // Edit manager: can create/update (no delete) orders/queue/payments.
        for (const r of [resources.orders!, resources.queue!, resources.payments!]) {
            await setUserPerm((editUser as any).id, (r as any).id, (actions.view as any).id, "allow", "branch");
            await setUserPerm((editUser as any).id, (r as any).id, (actions.create as any).id, "allow", "branch");
            await setUserPerm((editUser as any).id, (r as any).id, (actions.update as any).id, "allow", "branch");
            await setUserPerm((editUser as any).id, (r as any).id, (actions.delete as any).id, "deny", "none");
        }

        // None manager: deny everything for these resources.
        for (const r of [resources.orders!, resources.queue!, resources.payments!]) {
            await setUserPerm((noneUser as any).id, (r as any).id, (actions.view as any).id, "deny", "none");
            await setUserPerm((noneUser as any).id, (r as any).id, (actions.create as any).id, "deny", "none");
            await setUserPerm((noneUser as any).id, (r as any).id, (actions.update as any).id, "deny", "none");
            await setUserPerm((noneUser as any).id, (r as any).id, (actions.delete as any).id, "deny", "none");
        }

        // Seed minimal POS master data for branch A.
        const catA = await catRepo.save(
            catRepo.create({
                category_name: `cat_${runId}`,
                display_name: `Category ${runId}`,
                branch_id: (branchA as any).id,
                is_active: true,
            } as any)
        );
        const unitA = await unitRepo.save(
            unitRepo.create({
                unit_name: `unit_${runId}`,
                display_name: `Unit ${runId}`,
                branch_id: (branchA as any).id,
                is_active: true,
            } as any)
        );
        const prodA = await prodRepo.save(
            prodRepo.create({
                branch_id: (branchA as any).id,
                product_name: `P_${runId}`,
                display_name: `Product ${runId}`,
                description: `verify ${runId}`,
                price: 10,
                cost: 5,
                price_delivery: 10,
                category_id: (catA as any).id,
                unit_id: (unitA as any).id,
                is_active: true,
            } as any)
        );
        const tableA = await tableRepo.save(
            tableRepo.create({
                table_name: `TB-${runId}`,
                branch_id: (branchA as any).id,
                status: TableStatus.Available,
                is_active: true,
            } as any)
        );
        const deliveryA = await deliveryRepo.save(
            deliveryRepo.create({
                delivery_name: `DL-${runId}`,
                display_name: `Delivery ${runId}`,
                delivery_prefix: `DL${runId}`,
                branch_id: (branchA as any).id,
                is_active: true,
            } as any)
        );
        const cashMethod = await pmRepo.save(
            pmRepo.create({
                payment_method_name: `Cash-${runId}`,
                display_name: `Cash ${runId}`,
                branch_id: (branchA as any).id,
                is_active: true,
            } as any)
        );

        logOk("Seeded branches/users/permissions + minimal POS data for orders/payments/queue verification");

        // --- API verification ---
        const adminCookie = await login(adminUsername, adminPassword);
        const adminCsrf = await getCsrf(adminCookie);

        // Admin must select active branch (requireBranchStrict)
        {
            const res = await jsonFetch("/pos/orders", {
                method: "POST",
                cookie: adminCsrf.cookie,
                csrfToken: adminCsrf.csrfToken,
                body: JSON.stringify({ order_type: "TakeAway", items: [{ product_id: (prodA as any).id, quantity: 1 }] }),
            });
            assert(res.status === 403, `admin create order without active branch expected 403, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("admin cannot create order without active branch selection (403)");
        }

        const adminCookieWithBranch = await switchBranch(adminCsrf.cookie, adminCsrf.csrfToken, (branchA as any).id);
        logOk("admin switched active branch for POS order operations");

        // Must open shift before creating orders (business rule)
        {
            const res = await jsonFetch("/pos/orders", {
                method: "POST",
                cookie: adminCookieWithBranch,
                csrfToken: adminCsrf.csrfToken,
                body: JSON.stringify({ order_type: "TakeAway", items: [{ product_id: (prodA as any).id, quantity: 1 }] }),
            });
            assert(res.status === 400, `admin create order without open shift expected 400, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("admin cannot create order without open shift (400)");
        }

        // Open shift
        {
            const res = await jsonFetch("/pos/shifts/open", {
                method: "POST",
                cookie: adminCookieWithBranch,
                csrfToken: adminCsrf.csrfToken,
                body: JSON.stringify({ start_amount: 0 }),
            });
            assert(res.status === 201, `admin open shift expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("admin can open shift (201)");
        }

        // Create order (TakeAway) with items
        let orderId = "";
        {
            const res = await jsonFetch("/pos/orders", {
                method: "POST",
                cookie: adminCookieWithBranch,
                csrfToken: adminCsrf.csrfToken,
                body: JSON.stringify({
                    order_type: OrderType.TakeAway,
                    status: OrderStatus.Pending,
                    items: [{ product_id: (prodA as any).id, quantity: 2 }],
                }),
            });
            assert(res.status === 201, `admin create order expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
            orderId = res.json?.data?.id || res.json?.id;
            assert(orderId, "admin create order: missing id");
            logOk("admin can create order (201)");
        }

        // Queue should contain the order (auto-added when pending)
        {
            const res = await jsonFetch("/pos/queue", { method: "GET", cookie: adminCookieWithBranch });
            assert(res.status === 200, `admin get queue expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
            const items = res.json?.data || res.json;
            const found = Array.isArray(items) && items.some((q: any) => q.order_id === orderId);
            assert(found, "expected created order to appear in order_queue");
            logOk("order is auto-added to queue (200 + present)");
        }

        // Move order to WaitingForPayment (simulate finish cooking)
        {
            const res = await jsonFetch(`/pos/orders/${orderId}`, {
                method: "PUT",
                cookie: adminCookieWithBranch,
                csrfToken: adminCsrf.csrfToken,
                body: JSON.stringify({ status: OrderStatus.WaitingForPayment }),
            });
            assert(res.status === 200, `admin update order status expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("admin can update order status to WaitingForPayment (200)");
        }

        // Create payment -> should complete order and mark items Paid
        {
            const res = await jsonFetch("/pos/payments", {
                method: "POST",
                cookie: adminCookieWithBranch,
                csrfToken: adminCsrf.csrfToken,
                body: JSON.stringify({
                    order_id: orderId,
                    payment_method_id: (cashMethod as any).id,
                    amount: 20,
                    amount_received: 20,
                }),
            });
            assert(res.status === 201, `admin create payment expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("admin can create payment (201)");
        }

        {
            const res = await jsonFetch(`/pos/orders/${orderId}`, { method: "GET", cookie: adminCookieWithBranch });
            assert(res.status === 200, `admin fetch order expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
            const order: SalesOrder = res.json?.data || res.json;
            assert([OrderStatus.Completed, OrderStatus.Paid].includes(order.status as any), `expected order status Completed/Paid, got ${order.status}`);
            const items: SalesOrderItem[] = (order as any).items || [];
            assert(items.length > 0, "expected order.items");
            assert(items.every(i => i.status === OrderStatus.Paid || i.status === OrderStatus.Completed), `expected all items Paid/Completed, got: ${items.map(i => i.status).join(",")}`);
            logOk("payment updates order + items status (200)");
        }

        // Manager view-only checks
        const viewLoginCookie = await login(`pos_view_${runId}`, `View${runId}!`);
        const viewCsrf = await getCsrf(viewLoginCookie);

        // Non-admin users always operate in their own branch context via their user.branch_id.
        // They also must not be able to switch branch context (admin-only).
        {
            const res = await jsonFetch("/auth/switch-branch", {
                method: "POST",
                cookie: viewCsrf.cookie,
                csrfToken: viewCsrf.csrfToken,
                body: JSON.stringify({ branch_id: (branchB as any).id }),
            });
            assert(res.status === 403, `view mgr switch branch expected 403, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("manager view-only cannot switch active branch (403)");
        }

        {
            const res = await jsonFetch("/pos/orders", { method: "GET", cookie: viewCsrf.cookie });
            assert(res.status === 200, `view mgr list orders expected 200, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("manager view-only can list orders (200)");
        }
        {
            const res = await jsonFetch("/pos/orders", {
                method: "POST",
                cookie: viewCsrf.cookie,
                csrfToken: viewCsrf.csrfToken,
                body: JSON.stringify({ order_type: OrderType.TakeAway, items: [{ product_id: (prodA as any).id, quantity: 1 }] }),
            });
            assert(res.status === 403, `view mgr create order expected 403, got ${res.status}`);
            logOk("manager view-only cannot create order (403)");
        }
        {
            const res = await jsonFetch("/pos/payments", {
                method: "POST",
                cookie: viewCsrf.cookie,
                csrfToken: viewCsrf.csrfToken,
                body: JSON.stringify({ order_id: orderId, payment_method_id: (cashMethod as any).id, amount: 1 }),
            });
            assert(res.status === 403, `view mgr create payment expected 403, got ${res.status}`);
            logOk("manager view-only cannot create payment (403)");
        }

        // Manager edit can create orders and payments but not delete
        const editLoginCookie = await login(`pos_edit_${runId}`, `Edit${runId}!`);
        const editCsrf = await getCsrf(editLoginCookie);
        {
            const res = await jsonFetch("/pos/orders", {
                method: "POST",
                cookie: editCsrf.cookie,
                csrfToken: editCsrf.csrfToken,
                body: JSON.stringify({ order_type: OrderType.DineIn, table_id: (tableA as any).id, items: [{ product_id: (prodA as any).id, quantity: 1 }] }),
            });
            assert(res.status === 201, `edit mgr create order expected 201, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("manager edit can create order (201)");
        }
        {
            const res = await jsonFetch("/pos/payments", {
                method: "POST",
                cookie: editCsrf.cookie,
                csrfToken: editCsrf.csrfToken,
                body: JSON.stringify({ order_id: orderId, payment_method_id: (cashMethod as any).id, amount: 1, amount_received: 1 }),
            });
            // Payment might fail 400 if order already completed; in that case the permission check already passed (not 403).
            assert(res.status !== 403, `edit mgr create payment should not be 403, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("manager edit can attempt create payment (not 403)");
        }
        {
            const res = await jsonFetch(`/pos/orders/${orderId}`, { method: "DELETE", cookie: editCsrf.cookie, csrfToken: editCsrf.csrfToken });
            assert(res.status === 403, `edit mgr delete order expected 403, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("manager edit cannot delete order (403)");
        }

        // None user cannot list
        const noneLoginCookie = await login(`pos_none_${runId}`, `None${runId}!`);
        const noneCsrf = await getCsrf(noneLoginCookie);
        {
            const res = await jsonFetch("/pos/orders", { method: "GET", cookie: noneCsrf.cookie });
            assert(res.status === 403, `none mgr list orders expected 403, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("manager no-access cannot list orders (403)");
        }

        // Branch isolation: create order on branch B directly, branch A manager cannot read it
        const orderRepo = AppDataSource.getRepository(SalesOrder);
        const itemRepo = AppDataSource.getRepository(SalesOrderItem);
        const catB = await catRepo.save(
            catRepo.create({ category_name: `catB_${runId}`, display_name: `CategoryB ${runId}`, branch_id: (branchB as any).id, is_active: true } as any)
        );
        const unitB = await unitRepo.save(
            unitRepo.create({ unit_name: `unitB_${runId}`, display_name: `UnitB ${runId}`, branch_id: (branchB as any).id, is_active: true } as any)
        );
        const prodB = await prodRepo.save(
            prodRepo.create({
                branch_id: (branchB as any).id,
                product_name: `PB-${runId}`,
                display_name: `ProductB ${runId}`,
                description: "branch B",
                price: 10,
                cost: 5,
                price_delivery: 10,
                category_id: (catB as any).id,
                unit_id: (unitB as any).id,
                is_active: true,
            } as any)
        );
        const orderB = await orderRepo.save(
            orderRepo.create({
                branch_id: (branchB as any).id,
                order_no: `OB-${runId}`,
                order_type: OrderType.TakeAway,
                status: OrderStatus.Pending,
                sub_total: 10,
                vat: 0,
                total_amount: 10,
            } as any)
        );
        await itemRepo.save(
            itemRepo.create({
                order_id: (orderB as any).id,
                product_id: (prodB as any).id,
                quantity: 1,
                price: 10,
                total_price: 10,
                status: OrderStatus.Pending,
            } as any)
        );

        {
            const res = await jsonFetch(`/pos/orders/${(orderB as any).id}`, { method: "GET", cookie: viewCsrf.cookie });
            assert(res.status === 403 || res.status === 404, `branch isolation expected 403/404, got ${res.status}: ${JSON.stringify(res.json)}`);
            logOk("branch isolation: cannot access other-branch order (403/404)");
        }

        // Performance index presence (smoke) + forced plan for hot-path list
        {
            await AppDataSource.query(`ANALYZE "sales_orders"`);
            await AppDataSource.query(`ANALYZE "sales_order_item"`);
            await AppDataSource.query(`ANALYZE "payments"`);
            await AppDataSource.query(`ANALYZE "order_queue"`);

            const rows: Array<{ tablename: string; indexname: string }> = await AppDataSource.query(`
                SELECT tablename, indexname
                FROM pg_indexes
                WHERE schemaname='public'
                  AND tablename IN ('sales_orders','sales_order_item','payments','order_queue')
                  AND indexname ILIKE '%idx_%'
                ORDER BY tablename, indexname
            `);
            const idxNames = rows.map(r => `${r.tablename}:${r.indexname}`);
            assert(idxNames.some(n => n.includes("sales_orders:idx_sales_orders_branch_created_at_desc")), "missing orders list index: idx_sales_orders_branch_created_at_desc");
            assert(idxNames.some(n => n.includes("sales_orders:idx_sales_orders_branch_status_created_at_desc")), "missing orders list index: idx_sales_orders_branch_status_created_at_desc");
            assert(idxNames.some(n => n.includes("sales_orders:idx_sales_orders_branch_status_type_created_at_desc")), "missing orders list index: idx_sales_orders_branch_status_type_created_at_desc");
            assert(idxNames.some(n => n.includes("sales_order_item:idx_sales_order_item_order_status")), "missing order items index: idx_sales_order_item_order_status");
            assert(idxNames.some(n => n.includes("payments:idx_payments_order_status")), "missing payments index: idx_payments_order_status");
            assert(idxNames.some(n => n.includes("order_queue:IDX_order_queue_branch_status")), "missing order_queue index: IDX_order_queue_branch_status");
            logInfo(`Found indexes: ${idxNames.join(", ")}`);

            // Forced plan: orders list by branch + status + created desc
            // `status` is a Postgres enum in this schema, so we need to cast the array
            // parameter to the column's enum[] type; otherwise Postgres errors on enum = text.
            const statusTypeRow: Array<{ typ: string }> = await AppDataSource.query(
                `
                SELECT a.atttypid::regtype::text AS typ
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'sales_orders'
                  AND a.attname = 'status'
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                LIMIT 1
                `
            );
            assert(statusTypeRow?.[0]?.typ, "could not resolve enum type for sales_orders.status");
            const statusEnumType = statusTypeRow[0].typ;

            await AppDataSource.query(`SET enable_seqscan=off`);
            const explain: Array<{ "QUERY PLAN": string }> = await AppDataSource.query(
                `EXPLAIN SELECT id FROM "sales_orders" WHERE branch_id = $1 AND status = ANY($2::${statusEnumType}[]) ORDER BY create_date DESC LIMIT 20`,
                [(branchA as any).id, ["Pending", "Cooking", "Served", "WaitingForPayment"]]
            );
            await AppDataSource.query(`RESET enable_seqscan`);
            const plan = explain.map(r => r["QUERY PLAN"]).join("\n");
            // For small LIMIT queries, Postgres may prefer scanning the newest rows by branch and then filtering
            // status, which is often faster than merging multiple status-scoped index scans.
            // We accept any of the branch-scoped hot-path indexes here.
            assert(
                /idx_sales_orders_branch_created_at_desc|idx_sales_orders_branch_status_created_at_desc|idx_sales_orders_branch_status_type_created_at_desc/i.test(plan),
                `expected orders list to use a branch-scoped index. plan:\n${plan}`
            );
            logOk("orders list uses a branch-scoped index (forced plan)");
        }

        logOk("POS orders+payments+queue verification completed");
        logInfo("Created test users (local only):");
        logInfo(`- pos_view_${runId} / View${runId}! (view-only)`);
        logInfo(`- pos_edit_${runId} / Edit${runId}! (create+update, no delete)`);
        logInfo(`- pos_none_${runId} / None${runId}! (no access)`);
    });
}

main().catch((e) => {
    process.stderr.write(`[FAIL] Error: ${e?.stack || e}\n`);
    process.exit(1);
});
