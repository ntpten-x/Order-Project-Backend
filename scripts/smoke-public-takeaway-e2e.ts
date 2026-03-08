import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { AppDataSource } from "../src/database/database";
import { getDbManager, getRepository, runWithDbContext } from "../src/database/dbContext";
import { Users } from "../src/entity/Users";
import { Products } from "../src/entity/pos/Products";
import { Category } from "../src/entity/pos/Category";
import { ProductsUnit } from "../src/entity/pos/ProductsUnit";
import { ShopProfile } from "../src/entity/pos/ShopProfile";
import { OrderType } from "../src/entity/pos/OrderEnums";
import { ShiftsService } from "../src/services/pos/shifts.service";

loadEnv();

const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const shiftsService = new ShiftsService();

type Fixture = {
    branchId: string;
    userId: string;
    productId: string;
    token: string;
    restore: () => Promise<void>;
};

type ApiEnvelope<T> = {
    success?: boolean;
    data?: T;
    error?: {
        message?: string;
    } | string;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

async function cleanupOrders(orderIds: string[]): Promise<void> {
    if (orderIds.length === 0) return;

    await runWithDbContext({ isAdmin: true }, async () => {
        const db = getDbManager();
        await db.query(`DELETE FROM payments WHERE order_id = ANY($1::uuid[])`, [orderIds]);
        await db.query(
            `DELETE FROM sales_order_detail WHERE orders_item_id IN (
                SELECT id FROM sales_order_item WHERE order_id = ANY($1::uuid[])
            )`,
            [orderIds]
        );
        await db.query(`DELETE FROM sales_order_item WHERE order_id = ANY($1::uuid[])`, [orderIds]);
        await db.query(`DELETE FROM sales_orders WHERE id = ANY($1::uuid[])`, [orderIds]);
    });
}

async function ensureFixture(): Promise<Fixture> {
    let branchId = "";
    let userId = "";
    let productId = "";

    await runWithDbContext({ isAdmin: true }, async () => {
        const actor = await getRepository(Users)
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.roles", "r")
            .where("u.branch_id IS NOT NULL")
            .andWhere("u.is_use = true")
            .orderBy("u.create_date", "ASC")
            .getOne();

        assert(actor?.id, "No active user with branch context found for takeaway smoke test");
        assert(actor?.branch_id, "No branch found for takeaway smoke test actor");

        branchId = String(actor.id ? actor.branch_id : "");
        userId = String(actor.id);

        await runWithDbContext(
            {
                branchId,
                userId,
                role: actor.roles?.roles_name,
                isAdmin: actor.roles?.roles_name === "Admin",
            },
            async () => {
                await shiftsService.openShift(userId, 0, branchId);
            }
        );

        const existingProduct = await getRepository(Products)
            .createQueryBuilder("product")
            .innerJoin("product.category", "category")
            .where("product.branch_id = :branchId", { branchId })
            .andWhere("product.is_active = true")
            .andWhere("category.is_active = true")
            .orderBy("product.create_date", "ASC")
            .getOne();

        if (existingProduct) {
            productId = existingProduct.id;
            return;
        }

        const suffix = Date.now();
        const category = await getRepository(Category).save({
            branch_id: branchId,
            display_name: `SMOKE TAKEAWAY CAT ${suffix}`,
            is_active: true,
        } as Category);

        const unit = await getRepository(ProductsUnit).save({
            branch_id: branchId,
            display_name: `SMOKE TAKEAWAY UNIT ${suffix}`,
            is_active: true,
        } as ProductsUnit);

        const createdProduct = await getRepository(Products).save({
            branch_id: branchId,
            display_name: `SMOKE TAKEAWAY PRODUCT ${suffix}`,
            description: "smoke public takeaway order product",
            price: 59,
            cost: 20,
            price_delivery: 59,
            category_id: category.id,
            unit_id: unit.id,
            is_active: true,
        } as Products);

        productId = createdProduct.id;
    });

    const token = `smoke_tw_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const profileRepo = getRepository(ShopProfile);

    const profile = await runWithDbContext({ isAdmin: true }, async () => {
        const existing = await profileRepo.findOne({ where: { branch_id: branchId } });
        if (existing) {
            const previous = {
                takeaway_qr_token: existing.takeaway_qr_token ?? null,
                takeaway_qr_expires_at: existing.takeaway_qr_expires_at ?? null,
            };

            existing.takeaway_qr_token = token;
            existing.takeaway_qr_expires_at = expiresAt;
            await profileRepo.save(existing);

            return {
                profileId: existing.id,
                previous,
            };
        }

        const created = await profileRepo.save({
            branch_id: branchId,
            shop_name: `SMOKE TAKEAWAY SHOP ${Date.now()}`,
            address: "",
            phone: "",
            takeaway_qr_token: token,
            takeaway_qr_expires_at: expiresAt,
        } as ShopProfile);

        return {
            profileId: created.id,
            previous: null,
        };
    });

    return {
        branchId,
        userId,
        productId,
        token,
        restore: async () => {
            await runWithDbContext({ isAdmin: true }, async () => {
                if (profile.previous) {
                    await profileRepo.update(profile.profileId, {
                        takeaway_qr_token: profile.previous.takeaway_qr_token,
                        takeaway_qr_expires_at: profile.previous.takeaway_qr_expires_at,
                    } as Partial<ShopProfile>);
                } else {
                    await profileRepo.delete(profile.profileId);
                }
            });
        },
    };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
    const response = await fetch(`${FRONTEND_BASE_URL}${path}`, {
        ...init,
        headers: {
            Accept: "application/json",
            ...(init?.headers || {}),
        },
    });

    const body = (await response.json()) as T;
    return { status: response.status, body };
}

async function run(): Promise<void> {
    const createdOrderIds: string[] = [];
    let fixture: Fixture | null = null;

    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        const health = await fetch(`${FRONTEND_BASE_URL}/api/health`);
        assert(health.ok, `Frontend health check failed at ${FRONTEND_BASE_URL}/api/health`);

        fixture = await ensureFixture();
        const bootstrap = await fetchJson<ApiEnvelope<{
            channel: { kind: string; shop_name: string };
            menu: Array<{ items: Array<{ id: string }> }>;
            policy: { requires_customer_identity: boolean };
        }>>(`/api/public/takeaway-order/${encodeURIComponent(fixture.token)}`);

        assert(bootstrap.status === 200, `Bootstrap request failed with status ${bootstrap.status}`);
        assert(bootstrap.body.success === true, "Bootstrap response was not successful");
        assert(bootstrap.body.data?.channel.kind === "takeaway", "Bootstrap channel kind mismatch");
        assert(bootstrap.body.data?.policy.requires_customer_identity === true, "Bootstrap policy mismatch");
        const fixtureProductId = fixture.productId;
        assert(
            (bootstrap.body.data?.menu || []).some((category) =>
                (category.items || []).some((item) => item.id === fixtureProductId)
            ),
            "Bootstrap menu does not include prepared product"
        );

        const idempotencyKey = `smoke-${randomUUID()}`;
        const submitPayload = {
            customer_name: `Smoke Customer ${Date.now()}`,
            items: [{ product_id: fixture.productId, quantity: 1, notes: "smoke order" }],
        };

        const submitted = await fetchJson<ApiEnvelope<{
            mode: string;
            order: { id: string; order_type: string; customer_name: string | null };
        }>>(`/api/public/takeaway-order/${encodeURIComponent(fixture.token)}/order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify(submitPayload),
        });

        assert(submitted.status === 200, `Submit request failed with status ${submitted.status}`);
        assert(submitted.body.success === true, "Submit response was not successful");
        assert(submitted.body.data?.mode === "create", "Submit mode mismatch");
        assert(submitted.body.data?.order.order_type === OrderType.TakeAway, "Order type mismatch");
        assert(submitted.body.data?.order.customer_name === submitPayload.customer_name, "Customer name mismatch");
        assert(submitted.body.data?.order.id, "Submit response missing order id");

        const orderId = String(submitted.body.data?.order.id);
        createdOrderIds.push(orderId);

        const replay = await fetchJson<ApiEnvelope<{
            mode: string;
            order: { id: string };
        }>>(`/api/public/takeaway-order/${encodeURIComponent(fixture.token)}/order`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": idempotencyKey,
            },
            body: JSON.stringify(submitPayload),
        });

        assert(replay.status === 200, `Replay submit failed with status ${replay.status}`);
        assert(replay.body.success === true, "Replay submit response was not successful");
        assert(replay.body.data?.order.id === orderId, "Idempotency replay returned a different order");

        const loaded = await fetchJson<ApiEnvelope<{
            order: { id: string; order_type: string; items: Array<{ product_id: string }> };
            channel: { kind: string };
        }>>(
            `/api/public/takeaway-order/${encodeURIComponent(fixture.token)}/order/${encodeURIComponent(orderId)}`
        );

        assert(loaded.status === 200, `Get-order request failed with status ${loaded.status}`);
        assert(loaded.body.success === true, "Get-order response was not successful");
        assert(loaded.body.data?.channel.kind === "takeaway", "Get-order channel kind mismatch");
        assert(loaded.body.data?.order.id === orderId, "Loaded order id mismatch");
        assert(loaded.body.data?.order.order_type === OrderType.TakeAway, "Loaded order type mismatch");
        assert(
            (loaded.body.data?.order.items || []).some((item) => item.product_id === fixtureProductId),
            "Loaded order items do not contain submitted product"
        );

        console.log(
            JSON.stringify(
                {
                    ok: true,
                    frontendBaseUrl: FRONTEND_BASE_URL,
                    token: fixture.token,
                    orderId,
                    checks: ["bootstrap", "submit", "idempotency-replay", "get-order"],
                },
                null,
                2
            )
        );
    } finally {
        await cleanupOrders(createdOrderIds);
        if (fixture) {
            await fixture.restore();
        }
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

run().catch((error) => {
    console.error(
        JSON.stringify(
            {
                ok: false,
                message: error instanceof Error ? error.message : "Unknown smoke test failure",
            },
            null,
            2
        )
    );
    process.exit(1);
});
