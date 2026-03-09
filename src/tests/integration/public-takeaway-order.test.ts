import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { AppDataSource } from "../../database/database";
import { getDbManager, getRepository, runWithDbContext } from "../../database/dbContext";
import { PublicTakeawayOrderService } from "../../services/public/takeawayOrderPublic.service";
import { ShiftsService } from "../../services/pos/shifts.service";
import { Users } from "../../entity/Users";
import { Category } from "../../entity/pos/Category";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { Products } from "../../entity/pos/Products";
import { ShopProfile } from "../../entity/pos/ShopProfile";
import { OrderType } from "../../entity/pos/OrderEnums";
import { ShiftStatus } from "../../entity/pos/Shifts";

loadEnv();

const requiredEnv = ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
const hasRequiredEnv = requiredEnv.every((k) => Boolean(process.env[k] && !String(process.env[k]).includes("<CHANGE_ME>")));
const describeIntegration = hasRequiredEnv ? describe : describe.skip;

const publicService = new PublicTakeawayOrderService();
const shiftsService = new ShiftsService();

async function cleanupOrders(orderIds: string[]): Promise<void> {
    if (orderIds.length === 0) return;

    await runWithDbContext({ isAdmin: true }, async () => {
        const db = getDbManager();
        await db.query(`DELETE FROM payments WHERE order_id = ANY($1::uuid[])`, [orderIds]);
        await db.query(
            `DELETE FROM sales_order_detail WHERE orders_item_id IN (
                SELECT id FROM sales_order_item WHERE order_id = ANY($1::uuid[])
            )`,
            [orderIds],
        );
        await db.query(`DELETE FROM sales_order_item WHERE order_id = ANY($1::uuid[])`, [orderIds]);
        await db.query(`DELETE FROM sales_orders WHERE id = ANY($1::uuid[])`, [orderIds]);
    });
}

describeIntegration("Public takeaway-order flow (DB integration)", () => {
    let integrationReady = false;
    let branchId = "";
    let userId = "";
    let productId = "";

    beforeAll(async () => {
        process.env.TYPEORM_SYNC = "false";

        try {
            if (!AppDataSource.isInitialized) {
                await AppDataSource.initialize();
            }

            await runWithDbContext({ isAdmin: true }, async () => {
                const actor = await getRepository(Users)
                    .createQueryBuilder("u")
                    .leftJoinAndSelect("u.roles", "r")
                    .where("u.branch_id IS NOT NULL")
                    .andWhere("u.is_use = true")
                    .orderBy("u.create_date", "ASC")
                    .getOne();

                expect(actor?.id).toBeTruthy();
                expect(actor?.branch_id).toBeTruthy();

                branchId = String(actor!.branch_id);
                userId = String(actor!.id);

                await runWithDbContext(
                    {
                        branchId,
                        userId,
                        role: actor?.roles?.roles_name,
                        isAdmin: actor?.roles?.roles_name === "Admin",
                    },
                    async () => {
                        await shiftsService.openShift(userId, 0, branchId);
                    },
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
                    display_name: `IT TAKEAWAY CAT ${suffix}`,
                    is_active: true,
                } as any);

                const unit = await getRepository(ProductsUnit).save({
                    branch_id: branchId,
                    display_name: `IT TAKEAWAY UNIT ${suffix}`,
                    is_active: true,
                } as any);

                const createdProduct = await getRepository(Products).save({
                    branch_id: branchId,
                    display_name: `IT TAKEAWAY PRODUCT ${suffix}`,
                    description: "integration public takeaway order product",
                    price: 59,
                    cost: 20,
                    price_delivery: 59,
                    category_id: category.id,
                    unit_id: unit.id,
                    is_active: true,
                } as any);

                productId = createdProduct.id;
            });

            integrationReady = true;
        } catch (error) {
            integrationReady = false;
            console.warn("[public-takeaway-order.test] skip runtime integration: database is not reachable", error);
        }
    }, 120000);

    afterAll(async () => {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    async function createTakeawayFixture() {
        const token = `twtest_${randomUUID().replace(/-/g, "")}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const profileRepo = getRepository(ShopProfile);

        const profile = await runWithDbContext({ isAdmin: true }, async () => {
            const existing = await profileRepo.findOne({ where: { branch_id: branchId } as any });
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
                    token,
                    previous,
                };
            }

            const created = await profileRepo.save({
                branch_id: branchId,
                shop_name: `IT TAKEAWAY SHOP ${Date.now()}`,
                address: "",
                phone: "",
                takeaway_qr_token: token,
                takeaway_qr_expires_at: expiresAt,
            } as any);

            return {
                profileId: created.id,
                token,
                previous: null,
            };
        });

        return {
            token: profile.token,
            async restore() {
                await runWithDbContext({ isAdmin: true }, async () => {
                    if (profile.previous) {
                        await profileRepo.update(profile.profileId, {
                            takeaway_qr_token: profile.previous.takeaway_qr_token,
                            takeaway_qr_expires_at: profile.previous.takeaway_qr_expires_at,
                        } as any);
                    } else {
                        await profileRepo.delete(profile.profileId);
                    }
                });
            },
        };
    }

    async function setBranchShiftOpenState(open: boolean) {
        await runWithDbContext({ isAdmin: true }, async () => {
            if (open) {
                await shiftsService.openShift(userId, 0, branchId);
                return;
            }

            await getDbManager().query(
                `UPDATE shifts
                 SET status = $2,
                     close_time = NOW()
                 WHERE branch_id = $1
                   AND status = $3`,
                [branchId, ShiftStatus.CLOSED, ShiftStatus.OPEN],
            );
        });
    }

    it("bootstraps menu and creates a new takeaway order for every submit", async () => {
        if (!integrationReady) return;
        expect(branchId).toBeTruthy();
        expect(productId).toBeTruthy();

        await setBranchShiftOpenState(true);
        const fixture = await createTakeawayFixture();
        const createdOrderIds: string[] = [];

        try {
            const bootstrap = await publicService.getBootstrapByToken(fixture.token);
            expect(bootstrap.channel.kind).toBe("takeaway");
            expect(Array.isArray(bootstrap.menu)).toBe(true);
            expect(bootstrap.menu.length).toBeGreaterThan(0);
            expect(bootstrap.policy.requires_customer_identity).toBe(true);

            const first = await publicService.submitByToken(fixture.token, {
                customer_name: `IT CUSTOMER ${Date.now()}`,
                items: [{ product_id: productId, quantity: 1, notes: "no chili" }],
            });
            expect(first.order).toBeTruthy();
            if (!first.order) {
                throw new Error("Expected first takeaway order to be created");
            }
            createdOrderIds.push(first.order.id);

            expect(first.mode).toBe("create");
            expect(first.order.order_type).toBe(OrderType.TakeAway);
            expect(first.order.customer_name).toBeTruthy();

            const second = await publicService.submitByToken(fixture.token, {
                customer_name: "0891234567",
                items: [{ product_id: productId, quantity: 2, notes: "less sweet" }],
            });
            expect(second.order).toBeTruthy();
            if (!second.order) {
                throw new Error("Expected second takeaway order to be created");
            }
            createdOrderIds.push(second.order.id);

            expect(second.mode).toBe("create");
            expect(second.order.id).not.toBe(first.order.id);
            expect(second.order.customer_name).toBe("0891234567");

            const loaded = await publicService.resolveOrderByToken(fixture.token, second.order.id);
            expect(loaded.order?.id).toBe(second.order.id);
            expect(loaded.order?.customer_name).toBe("0891234567");
        } finally {
            await cleanupOrders(createdOrderIds);
            await fixture.restore();
        }
    }, 120000);

    it("rejects submit when customer identity is missing", async () => {
        if (!integrationReady) return;

        await setBranchShiftOpenState(true);
        const fixture = await createTakeawayFixture();
        try {
            await expect(
                publicService.submitByToken(fixture.token, {
                    items: [{ product_id: productId, quantity: 1, notes: "identity required" }],
                } as any),
            ).rejects.toMatchObject({
                statusCode: 400,
            });
        } finally {
            await fixture.restore();
        }
    }, 120000);

    it("rejects modifier details payload for takeaway QR flow", async () => {
        if (!integrationReady) return;

        await setBranchShiftOpenState(true);
        const fixture = await createTakeawayFixture();
        try {
            await expect(
                publicService.submitByToken(fixture.token, {
                    customer_name: "Modifier Test",
                    items: [
                        {
                            product_id: productId,
                            quantity: 1,
                            notes: "modifier should fail",
                            details: [{ detail_name: "extra cheese", extra_price: 10 }],
                        },
                    ],
                } as any),
            ).rejects.toMatchObject({
                statusCode: 400,
            });
        } finally {
            await fixture.restore();
        }
    }, 120000);

    it("rejects bootstrap when no active shift is open", async () => {
        if (!integrationReady) return;

        const fixture = await createTakeawayFixture();
        try {
            await setBranchShiftOpenState(false);

            await expect(publicService.getBootstrapByToken(fixture.token)).rejects.toMatchObject({
                statusCode: 403,
            });
        } finally {
            await setBranchShiftOpenState(true);
            await fixture.restore();
        }
    }, 120000);
});
