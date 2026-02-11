import "reflect-metadata";
import { beforeAll, describe, expect, it } from "vitest";
import * as dotenv from "dotenv";
import { AppDataSource } from "../../database/database";
import { Users } from "../../entity/Users";
import { Products } from "../../entity/pos/Products";
import { Category } from "../../entity/pos/Category";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { OrderStatus, OrderType } from "../../entity/pos/OrderEnums";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../../services/pos/orders.service";
import { PaymentsModels } from "../../models/pos/payments.model";
import { PaymentsService } from "../../services/pos/payments.service";
import { PaymentStatus } from "../../entity/pos/Payments";
import { DashboardService } from "../../services/pos/dashboard.service";
import { ShiftsService } from "../../services/pos/shifts.service";
import { runWithDbContext } from "../../database/dbContext";

dotenv.config();

const ordersService = new OrdersService(new OrdersModels());
const paymentsService = new PaymentsService(new PaymentsModels());
const dashboardService = new DashboardService();
const shiftsService = new ShiftsService();

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

describe("POS critical flow (DB integration)", () => {
    beforeAll(async () => {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
    }, 120000);

    it("handles cancel item -> payment -> dashboard summary consistently", async () => {
        const userRepo = AppDataSource.getRepository(Users);
        const productRepo = AppDataSource.getRepository(Products);
        const categoryRepo = AppDataSource.getRepository(Category);
        const unitRepo = AppDataSource.getRepository(ProductsUnit);
        const paymentMethodRepo = AppDataSource.getRepository(PaymentMethod);

        const actor = await userRepo
            .createQueryBuilder("u")
            .leftJoinAndSelect("u.roles", "r")
            .where("u.branch_id IS NOT NULL")
            .andWhere("u.is_use = true")
            .orderBy("u.create_date", "ASC")
            .getOne();

        expect(actor?.id).toBeTruthy();
        expect(actor?.branch_id).toBeTruthy();

        const branchId = actor!.branch_id!;
        const userId = actor!.id;
        const runAsBranch = <T>(fn: () => Promise<T>) =>
            runWithDbContext({ branchId, userId, role: actor!.roles?.roles_name, isAdmin: actor!.roles?.roles_name === "Admin" }, fn);

        const summaryBefore = await runAsBranch(async () => {
            const rows = await dashboardService.getSalesSummary(todayIsoDate(), todayIsoDate(), branchId);
            return rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
        });

        let product = await productRepo.findOne({ where: { branch_id: branchId, is_active: true } as any });

        if (!product) {
            const now = Date.now();
            const category = await categoryRepo.save({
                branch_id: branchId,
                category_name: `it-posflow-cat-${now}`,
                display_name: `IT POSFLOW CAT ${now}`,
                is_active: true,
            } as any);

            const unit = await unitRepo.save({
                branch_id: branchId,
                unit_name: `it-posflow-unit-${now}`,
                display_name: `IT POSFLOW UNIT ${now}`,
                is_active: true,
            } as any);

            product = await productRepo.save({
                    branch_id: branchId,
                    product_name: `it-posflow-product-${now}`,
                    display_name: `IT POSFLOW PRODUCT ${now}`,
                    description: "integration test product",
                    price: 100,
                    price_delivery: 100,
                    cost: 50,
                    category_id: category.id,
                    unit_id: unit.id,
                    is_active: true,
            } as any);
        }

        let paymentMethod = await paymentMethodRepo.findOne({
            where: { branch_id: branchId, is_active: true } as any,
            order: { create_date: "ASC" },
        });

        if (!paymentMethod) {
            const now = Date.now();
            paymentMethod = await paymentMethodRepo.save({
                branch_id: branchId,
                payment_method_name: `IT_CASH_${now}`,
                display_name: `IT CASH ${now}`,
                is_active: true,
            } as any);
        }

        await runAsBranch(async () => {
            await shiftsService.openShift(userId, 0, branchId);
        });

        const order = await runAsBranch(async () =>
            ordersService.createFullOrder(
                {
                    branch_id: branchId,
                    created_by_id: userId,
                    order_type: OrderType.TakeAway,
                    status: OrderStatus.Pending,
                    items: [
                        { product_id: product!.id, quantity: 1 },
                        { product_id: product!.id, quantity: 2 },
                    ],
                },
                branchId
            )
        );

        const loadedOrder = await runAsBranch(async () => ordersService.findOne(order.id, branchId));
        expect(loadedOrder?.items?.length).toBeGreaterThanOrEqual(2);

        const cancelItem = loadedOrder!.items[1];
        await runAsBranch(async () => ordersService.updateItemStatus(cancelItem.id, OrderStatus.Cancelled, branchId));

        const orderAfterCancel = await runAsBranch(async () => ordersService.findOne(order.id, branchId));
        expect(orderAfterCancel).toBeTruthy();
        const nonCancelledTotal = (orderAfterCancel!.items || [])
            .filter((item) => item.status !== OrderStatus.Cancelled && item.status !== OrderStatus.cancelled)
            .reduce((sum, item) => sum + Number(item.total_price || 0), 0);
        expect(Number(orderAfterCancel!.total_amount)).toBeCloseTo(nonCancelledTotal, 2);

        await runAsBranch(async () =>
            paymentsService.create(
                {
                    branch_id: branchId,
                    order_id: order.id,
                    payment_method_id: paymentMethod!.id,
                    amount: Number(orderAfterCancel!.total_amount),
                    amount_received: Number(orderAfterCancel!.total_amount),
                    status: PaymentStatus.Success,
                } as any,
                userId,
                branchId
            )
        );

        const finalOrder = await runAsBranch(async () => ordersService.findOne(order.id, branchId));
        expect(finalOrder?.status).toBe(OrderStatus.Completed);
        const statuses = (finalOrder?.items || []).map((i) => i.status);
        expect(statuses).toContain(OrderStatus.Cancelled);
        expect(statuses).toContain(OrderStatus.Paid);

        const summaryAfter = await runAsBranch(async () => {
            const rows = await dashboardService.getSalesSummary(todayIsoDate(), todayIsoDate(), branchId);
            return rows.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
        });

        const delta = Number(summaryAfter) - Number(summaryBefore);
        expect(delta).toBeGreaterThanOrEqual(Number(orderAfterCancel!.total_amount) - 0.01);

        await AppDataSource.query(
            `DELETE FROM payments WHERE order_id = $1`,
            [order.id]
        );
        await AppDataSource.query(
            `DELETE FROM order_queue WHERE order_id = $1`,
            [order.id]
        );
        await AppDataSource.query(
            `DELETE FROM sales_order_detail WHERE orders_item_id IN (SELECT id FROM sales_order_item WHERE order_id = $1)`,
            [order.id]
        );
        await AppDataSource.query(
            `DELETE FROM sales_order_item WHERE order_id = $1`,
            [order.id]
        );
        await AppDataSource.query(
            `DELETE FROM sales_orders WHERE id = $1`,
            [order.id]
        );
    }, 120000);
});
