import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { AppDataSource } from "../../database/database";
import { getDbManager, getRepository, runWithDbContext } from "../../database/dbContext";
import { PublicTableOrderService } from "../../services/public/tableOrderPublic.service";
import { ShiftsService } from "../../services/pos/shifts.service";
import { Users } from "../../entity/Users";
import { Category } from "../../entity/pos/Category";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { Products } from "../../entity/pos/Products";
import { TableStatus, Tables } from "../../entity/pos/Tables";
import { Topping } from "../../entity/pos/Topping";
import { ToppingGroup } from "../../entity/pos/ToppingGroup";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { ShiftStatus } from "../../entity/pos/Shifts";

loadEnv();

const requiredEnv = ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
const hasRequiredEnv = requiredEnv.every((k) => Boolean(process.env[k] && !String(process.env[k]).includes("<CHANGE_ME>")));
const describeIntegration = hasRequiredEnv ? describe : describe.skip;

const publicService = new PublicTableOrderService();
const shiftsService = new ShiftsService();

async function cleanupTableOrders(tableId: string): Promise<void> {
    await runWithDbContext({ isAdmin: true }, async () => {
        const db = getDbManager();
        await db.query(`DELETE FROM payments WHERE order_id IN (SELECT id FROM sales_orders WHERE table_id = $1)`, [tableId]);
        await db.query(
            `DELETE FROM sales_order_detail WHERE orders_item_id IN (
                SELECT soi.id
                FROM sales_order_item soi
                INNER JOIN sales_orders so ON so.id = soi.order_id
                WHERE so.table_id = $1
            )`,
            [tableId],
        );
        await db.query(`DELETE FROM sales_order_item WHERE order_id IN (SELECT id FROM sales_orders WHERE table_id = $1)`, [tableId]);
        await db.query(`DELETE FROM sales_orders WHERE table_id = $1`, [tableId]);
        await db.query(`DELETE FROM tables WHERE id = $1`, [tableId]);
    });
}

describeIntegration("Public table-order flow (DB integration)", () => {
    let integrationReady = false;
    let branchId = "";
    let userId = "";
    let productId = "";
    let toppingId = "";
    let toppingPrice = 0;
    const cleanupIds: {
        categoryId?: string;
        unitId?: string;
        productId?: string;
        toppingId?: string;
        toppingGroupId?: string;
    } = {};

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

                const suffix = Date.now();
                const category = await getRepository(Category).save({
                    branch_id: branchId,
                    display_name: `IT PUBLIC CAT ${suffix}`,
                    is_active: true,
                } as any);
                cleanupIds.categoryId = category.id;

                const unit = await getRepository(ProductsUnit).save({
                    branch_id: branchId,
                    display_name: `IT PUBLIC UNIT ${suffix}`,
                    is_active: true,
                } as any);
                cleanupIds.unitId = unit.id;

                const toppingGroup = await getRepository(ToppingGroup).save({
                    branch_id: branchId,
                    display_name: `IT PUBLIC TOPPING GROUP ${suffix}`,
                    is_active: true,
                } as any);
                cleanupIds.toppingGroupId = toppingGroup.id;

                const createdProduct = await getRepository(Products).save({
                    branch_id: branchId,
                    display_name: `IT PUBLIC PRODUCT ${suffix}`,
                    description: "integration public table order product",
                    price: 59,
                    cost: 20,
                    price_delivery: 59,
                    category_id: category.id,
                    unit_id: unit.id,
                    is_active: true,
                    topping_groups: [toppingGroup],
                } as any);
                cleanupIds.productId = createdProduct.id;
                productId = createdProduct.id;

                const createdTopping = await getRepository(Topping).save({
                    branch_id: branchId,
                    display_name: `IT PUBLIC TOPPING ${suffix}`,
                    price: 12,
                    price_delivery: 18,
                    img: null,
                    categories: [category],
                    topping_groups: [toppingGroup],
                    is_active: true,
                } as any);

                cleanupIds.toppingId = createdTopping.id;
                toppingId = createdTopping.id;
                toppingPrice = Number(createdTopping.price || 0);
            });

            integrationReady = true;
        } catch (error) {
            integrationReady = false;
            console.warn("[public-table-order.test] skip runtime integration: database is not reachable", error);
        }
    }, 120000);

    afterAll(async () => {
        await runWithDbContext({ isAdmin: true }, async () => {
            if (cleanupIds.toppingId) {
                await getRepository(Topping).delete(cleanupIds.toppingId);
            }
            if (cleanupIds.productId) {
                await getRepository(Products).delete(cleanupIds.productId);
            }
            if (cleanupIds.toppingGroupId) {
                await getRepository(ToppingGroup).delete(cleanupIds.toppingGroupId);
            }
            if (cleanupIds.unitId) {
                await getRepository(ProductsUnit).delete(cleanupIds.unitId);
            }
            if (cleanupIds.categoryId) {
                await getRepository(Category).delete(cleanupIds.categoryId);
            }
        });

        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    async function createPublicTableFixture() {
        const tableId = randomUUID();
        const tableToken = randomUUID().replace(/-/g, "");
        const tableName = `IT QR TABLE ${Date.now()}-${tableToken.slice(0, 6)}`;
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await runWithDbContext({ isAdmin: true }, async () => {
            await getRepository(Tables).save({
                id: tableId,
                table_name: tableName,
                branch_id: branchId,
                status: TableStatus.Available,
                is_active: true,
                qr_code_token: tableToken,
                qr_code_expires_at: expiresAt,
            } as any);
        });

        return {
            tableId,
            tableToken,
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

    async function submitWithOpenShift(token: string, payload: Parameters<typeof publicService.submitByToken>[1]) {
        try {
            return await publicService.submitByToken(token, payload);
        } catch (error) {
            if (error instanceof Error && error.message.includes("Active Shift Required")) {
                await setBranchShiftOpenState(true);
                return publicService.submitByToken(token, payload);
            }
            throw error;
        }
    }

    it("creates first order and appends items to the same active order", async () => {
        if (!integrationReady) return;
        expect(branchId).toBeTruthy();
        expect(productId).toBeTruthy();

        await setBranchShiftOpenState(true);
        const fixture = await createPublicTableFixture();
        try {
            const created = await submitWithOpenShift(fixture.tableToken, {
                items: [{ product_id: productId, quantity: 1, notes: "คมจัด" }],
            });
            const createdOrder = created.order;

            expect(created.mode).toBe("create");
            expect(createdOrder).toBeTruthy();
            if (!createdOrder) {
                throw new Error("Expected order to be created");
            }
            expect(createdOrder.id).toBeTruthy();
            expect(createdOrder.items.length).toBeGreaterThanOrEqual(1);

            const appended = await submitWithOpenShift(fixture.tableToken, {
                items: [{ product_id: productId, quantity: 2, notes: "หวานน้อย" }],
            });
            const appendedOrder = appended.order;

            expect(appended.mode).toBe("append");
            expect(appendedOrder).toBeTruthy();
            if (!appendedOrder) {
                throw new Error("Expected order to be appended");
            }
            expect(appendedOrder.id).toBe(createdOrder.id);
            expect(appendedOrder.items.length).toBeGreaterThanOrEqual(2);
            expect(Number(appendedOrder.total_amount)).toBeGreaterThanOrEqual(Number(createdOrder.total_amount));
        } finally {
            await cleanupTableOrders(fixture.tableId);
        }
    }, 120000);

    it("rejects submit when the latest table bill is locked", async () => {
        if (!integrationReady) return;
        await setBranchShiftOpenState(true);
        const fixture = await createPublicTableFixture();

        try {
            const created = await submitWithOpenShift(fixture.tableToken, {
                items: [{ product_id: productId, quantity: 1, notes: "ทดสอบ lock" }],
            });
            const createdOrder = created.order;
            expect(createdOrder).toBeTruthy();
            if (!createdOrder) {
                throw new Error("Expected order to be created before lock");
            }

            await runWithDbContext({ isAdmin: true }, async () => {
                await getDbManager().query(`UPDATE sales_orders SET status = $2, update_date = NOW() WHERE id = $1`, [
                    createdOrder.id,
                    OrderStatus.WaitingForPayment,
                ]);
            });

            await expect(
                publicService.submitByToken(fixture.tableToken, {
                    items: [{ product_id: productId, quantity: 1, notes: "ต้องถูกปฏิเสธ" }],
                }),
            ).rejects.toMatchObject({
                statusCode: 409,
            });
        } finally {
            await cleanupTableOrders(fixture.tableId);
        }
    }, 120000);

    it("accepts topping details payload for QR customer flow", async () => {
        if (!integrationReady) return;
        await setBranchShiftOpenState(true);
        const fixture = await createPublicTableFixture();

        try {
            const result = await submitWithOpenShift(fixture.tableToken, {
                items: [
                    {
                        product_id: productId,
                        quantity: 1,
                        notes: "ทดสอบ topping",
                        details: [{ topping_id: toppingId }],
                    },
                ],
            } as any);

            expect(result.order).toBeTruthy();
            if (!result.order) {
                throw new Error("Expected QR customer order with topping");
            }

            const firstItem = result.order.items[0];
            expect(firstItem).toBeTruthy();
            expect(Array.isArray(firstItem?.details)).toBe(true);
            expect(firstItem?.details?.[0]?.topping_id).toBe(toppingId);
            expect(Number(firstItem?.details?.[0]?.extra_price || 0)).toBe(toppingPrice);
            expect(Number(firstItem?.total_price || 0)).toBe(Number(firstItem?.price || 0) + toppingPrice);
        } finally {
            await cleanupTableOrders(fixture.tableId);
        }
    }, 120000);

    it("still allows bootstrap reads when no active shift is open, but blocks submit", async () => {
        if (!integrationReady) return;
        const fixture = await createPublicTableFixture();

        try {
            await setBranchShiftOpenState(false);

            const bootstrap = await publicService.getBootstrapByToken(fixture.tableToken);
            expect(bootstrap.table.id).toBe(fixture.tableId);
            expect(Array.isArray(bootstrap.menu)).toBe(true);
            expect(Array.isArray((bootstrap as any).toppings)).toBe(true);
            expect((bootstrap as any).toppings.some((item: { id: string }) => item.id === toppingId)).toBe(true);

            const activeOrder = await publicService.getActiveOrderByToken(fixture.tableToken);
            expect(activeOrder.table.id).toBe(fixture.tableId);
            expect(activeOrder.active_order).toBeNull();

            await expect(
                publicService.submitByToken(fixture.tableToken, {
                    items: [{ product_id: productId, quantity: 1, notes: "shift closed" }],
                }),
            ).rejects.toMatchObject({
                statusCode: 403,
            });
        } finally {
            await setBranchShiftOpenState(true);
            await cleanupTableOrders(fixture.tableId);
        }
    }, 120000);
});
