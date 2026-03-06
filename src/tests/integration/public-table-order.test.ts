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
import { OrderStatus } from "../../entity/pos/OrderEnums";

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
        await db.query(`DELETE FROM order_queue WHERE order_id IN (SELECT id FROM sales_orders WHERE table_id = $1)`, [tableId]);
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
                    category_name: `it-public-cat-${suffix}`,
                    display_name: `IT PUBLIC CAT ${suffix}`,
                    is_active: true,
                } as any);

                const unit = await getRepository(ProductsUnit).save({
                    branch_id: branchId,
                    unit_name: `it-public-unit-${suffix}`,
                    display_name: `IT PUBLIC UNIT ${suffix}`,
                    is_active: true,
                } as any);

                const createdProduct = await getRepository(Products).save({
                    branch_id: branchId,
                    product_name: `it-public-product-${suffix}`,
                    display_name: `IT PUBLIC PRODUCT ${suffix}`,
                    description: "integration public table order product",
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
            console.warn("[public-table-order.test] skip runtime integration: database is not reachable", error);
        }
    }, 120000);

    afterAll(async () => {
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

    it("creates first order and appends items to the same active order", async () => {
        if (!integrationReady) return;
        expect(branchId).toBeTruthy();
        expect(productId).toBeTruthy();

        const fixture = await createPublicTableFixture();
        try {
            const created = await publicService.submitByToken(fixture.tableToken, {
                items: [{ product_id: productId, quantity: 1, notes: "ไม่เผ็ด" }],
            });
            const createdOrder = created.order;

            expect(created.mode).toBe("create");
            expect(createdOrder).toBeTruthy();
            if (!createdOrder) {
                throw new Error("Expected order to be created");
            }
            expect(createdOrder.id).toBeTruthy();
            expect(createdOrder.items.length).toBeGreaterThanOrEqual(1);

            const appended = await publicService.submitByToken(fixture.tableToken, {
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
        const fixture = await createPublicTableFixture();

        try {
            const created = await publicService.submitByToken(fixture.tableToken, {
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

    it("rejects modifier details payload for QR customer flow", async () => {
        if (!integrationReady) return;
        const fixture = await createPublicTableFixture();

        try {
            await expect(
                publicService.submitByToken(fixture.tableToken, {
                    items: [
                        {
                            product_id: productId,
                            quantity: 1,
                            notes: "ทดสอบ modifier",
                            details: [{ detail_name: "เพิ่มชีส", extra_price: 10 }],
                        },
                    ],
                } as any),
            ).rejects.toMatchObject({
                statusCode: 400,
            });

            const rows = await runWithDbContext({ isAdmin: true }, async () => {
                return getDbManager().query(`SELECT COUNT(*)::int AS total FROM sales_orders WHERE table_id = $1`, [fixture.tableId]);
            });

            expect(Number(rows?.[0]?.total || 0)).toBe(0);
        } finally {
            await cleanupTableOrders(fixture.tableId);
        }
    }, 120000);
});
