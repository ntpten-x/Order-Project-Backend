import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import "reflect-metadata";
import { cleanupCompletedStockOrdersOlderThan } from "../../services/maintenance/orderRetention.service";

loadEnv();

const requiredEnv = ["DATABASE_HOST", "DATABASE_PORT", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"];
const hasRequiredEnv = requiredEnv.every((k) => Boolean(process.env[k] && !String(process.env[k]).includes("<CHANGE_ME>")));
const describeIntegration = hasRequiredEnv ? describe : describe.skip;

describeIntegration("stock retention integration", () => {
    let AppDataSource: (typeof import("../../database/database"))["AppDataSource"];
    let runWithDbContext: (typeof import("../../database/dbContext"))["runWithDbContext"];
    let getDbManager: (typeof import("../../database/dbContext"))["getDbManager"];
    let integrationReady = false;

    beforeAll(async () => {
        process.env.TYPEORM_SYNC = "false";
        try {
            ({ AppDataSource } = await import("../../database/database"));
            ({ runWithDbContext, getDbManager } = await import("../../database/dbContext"));
            if (!AppDataSource.isInitialized) {
                await AppDataSource.initialize();
            }
            integrationReady = true;
        } catch (error) {
            integrationReady = false;
            console.warn("[stock-retention.test] skip runtime integration: database is not reachable", error);
        }
    }, 120000);

    afterAll(async () => {
        if (AppDataSource?.isInitialized) {
            await AppDataSource.destroy();
        }
    });

    it("deletes only completed stock orders older than 7 days", async () => {
        if (!integrationReady) {
            return;
        }

        const createdOrderIds: string[] = [];
        const createdItemIds: string[] = [];
        const createdDetailIds: string[] = [];
        let createdIngredientId: string | null = null;
        let createdUnitId: string | null = null;

        try {
            await runWithDbContext({ isAdmin: true }, async () => {
                const db = getDbManager();

                const branchRows = await db.query(`SELECT id FROM branches WHERE is_active = true ORDER BY create_date ASC LIMIT 1`);
                expect(branchRows.length).toBeGreaterThan(0);
                const branchId = String(branchRows[0].id);

                const userRows = await db.query(`SELECT id FROM users WHERE branch_id = $1 ORDER BY create_date ASC LIMIT 1`, [branchId]);
                expect(userRows.length).toBeGreaterThan(0);
                const userId = String(userRows[0].id);

                const ingredientRows = await db.query(
                    `SELECT id FROM stock_ingredients WHERE branch_id = $1 AND is_active = true ORDER BY create_date ASC LIMIT 1`,
                    [branchId]
                );

                let ingredientId: string;
                if (ingredientRows.length > 0) {
                    ingredientId = String(ingredientRows[0].id);
                } else {
                    createdUnitId = randomUUID();
                    createdIngredientId = randomUUID();
                    const suffix = Date.now();

                    await db.query(
                        `
                        INSERT INTO stock_ingredients_unit (id, unit_name, display_name, branch_id, is_active, create_date)
                        VALUES ($1, $2, $3, $4, true, NOW())
                    `,
                        [createdUnitId, `e2e_unit_${suffix}`, `E2E Unit ${suffix}`, branchId]
                    );

                    await db.query(
                        `
                        INSERT INTO stock_ingredients (id, ingredient_name, display_name, branch_id, description, is_active, img_url, unit_id, create_date)
                        VALUES ($1, $2, $3, $4, $5, true, NULL, $6, NOW())
                    `,
                        [createdIngredientId, `e2e_ing_${suffix}`, `E2E Ingredient ${suffix}`, branchId, "e2e ingredient", createdUnitId]
                    );
                    ingredientId = createdIngredientId;
                }

                const oldCompletedOrderId = randomUUID();
                const recentCompletedOrderId = randomUUID();
                const oldPendingOrderId = randomUUID();
                createdOrderIds.push(oldCompletedOrderId, recentCompletedOrderId, oldPendingOrderId);

                await db.query(
                    `
                    INSERT INTO stock_orders (id, ordered_by_id, remark, branch_id, status, create_date, update_date)
                    VALUES
                        ($1, $2, $3, $4, 'completed', NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
                        ($5, $2, $6, $4, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
                        ($7, $2, $8, $4, 'pending', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days')
                `,
                    [
                        oldCompletedOrderId,
                        userId,
                        "stock-retention-old-completed",
                        branchId,
                        recentCompletedOrderId,
                        "stock-retention-recent-completed",
                        oldPendingOrderId,
                        "stock-retention-old-pending",
                    ]
                );

                const oldCompletedItemId = randomUUID();
                const recentCompletedItemId = randomUUID();
                const oldPendingItemId = randomUUID();
                createdItemIds.push(oldCompletedItemId, recentCompletedItemId, oldPendingItemId);

                await db.query(
                    `
                    INSERT INTO stock_orders_item (id, ingredient_id, orders_id, quantity_ordered)
                    VALUES
                        ($1, $2, $3, 5),
                        ($4, $2, $5, 6),
                        ($6, $2, $7, 7)
                `,
                    [oldCompletedItemId, ingredientId, oldCompletedOrderId, recentCompletedItemId, recentCompletedOrderId, oldPendingItemId, oldPendingOrderId]
                );

                const oldCompletedDetailId = randomUUID();
                const recentCompletedDetailId = randomUUID();
                const oldPendingDetailId = randomUUID();
                createdDetailIds.push(oldCompletedDetailId, recentCompletedDetailId, oldPendingDetailId);

                await db.query(
                    `
                    INSERT INTO stock_orders_detail (id, orders_item_id, actual_quantity, purchased_by_id, is_purchased, create_date)
                    VALUES
                        ($1, $2, 5, $3, true, NOW() - INTERVAL '8 days'),
                        ($4, $5, 6, $3, true, NOW() - INTERVAL '3 days'),
                        ($6, $7, 0, $3, false, NOW() - INTERVAL '9 days')
                `,
                    [oldCompletedDetailId, oldCompletedItemId, userId, recentCompletedDetailId, recentCompletedItemId, oldPendingDetailId, oldPendingItemId]
                );

                const result = await cleanupCompletedStockOrdersOlderThan({
                    retentionDays: 7,
                    statuses: ["completed"],
                    dryRun: false,
                    batchSize: 100,
                    maxBatches: 10,
                });

                expect(result.candidateOrders).toBeGreaterThanOrEqual(1);
                expect(result.deleted.orders).toBe(1);
                expect(result.deleted.items).toBe(1);
                expect(result.deleted.details).toBe(1);

                const oldCompletedRows = await db.query(`SELECT id FROM stock_orders WHERE id = $1`, [oldCompletedOrderId]);
                const recentCompletedRows = await db.query(`SELECT id FROM stock_orders WHERE id = $1`, [recentCompletedOrderId]);
                const oldPendingRows = await db.query(`SELECT id FROM stock_orders WHERE id = $1`, [oldPendingOrderId]);

                expect(oldCompletedRows).toHaveLength(0);
                expect(recentCompletedRows).toHaveLength(1);
                expect(oldPendingRows).toHaveLength(1);
            });
        } finally {
            await runWithDbContext({ isAdmin: true }, async () => {
                const db = getDbManager();
                if (createdDetailIds.length > 0) {
                    await db.query(`DELETE FROM stock_orders_detail WHERE id = ANY($1::uuid[])`, [createdDetailIds]);
                }
                if (createdItemIds.length > 0) {
                    await db.query(`DELETE FROM stock_orders_item WHERE id = ANY($1::uuid[])`, [createdItemIds]);
                }
                if (createdOrderIds.length > 0) {
                    await db.query(`DELETE FROM stock_orders WHERE id = ANY($1::uuid[])`, [createdOrderIds]);
                }
                if (createdIngredientId) {
                    await db.query(`DELETE FROM stock_ingredients WHERE id = $1`, [createdIngredientId]);
                }
                if (createdUnitId) {
                    await db.query(`DELETE FROM stock_ingredients_unit WHERE id = $1`, [createdUnitId]);
                }
            });
        }
    }, 120000);
});
