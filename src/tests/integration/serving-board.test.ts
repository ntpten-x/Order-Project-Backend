import "reflect-metadata";
import { beforeAll, describe, expect, it } from "vitest";
import * as dotenv from "dotenv";
import { AppDataSource } from "../../database/database";
import { getRepository, runWithDbContext } from "../../database/dbContext";
import { Users } from "../../entity/Users";
import { Category } from "../../entity/pos/Category";
import { OrderStatus, OrderType, ServingStatus } from "../../entity/pos/OrderEnums";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { Products } from "../../entity/pos/Products";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { PaymentStatus } from "../../entity/pos/Payments";
import { OrdersModels } from "../../models/pos/orders.model";
import { PaymentsModels } from "../../models/pos/payments.model";
import { OrdersService } from "../../services/pos/orders.service";
import { PaymentsService } from "../../services/pos/payments.service";
import { ShiftsService } from "../../services/pos/shifts.service";

dotenv.config();

const ordersService = new OrdersService(new OrdersModels());
const paymentsService = new PaymentsService(new PaymentsModels());
const shiftsService = new ShiftsService();

describe("Serving board flow (DB integration)", () => {
    beforeAll(async () => {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
    }, 120000);

    it("separates add rounds, tracks serve status, and clears when order is paid", async () => {
        const userRepo = AppDataSource.getRepository(Users);
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
            runWithDbContext(
                {
                    branchId,
                    userId,
                    role: actor!.roles?.roles_name,
                    isAdmin: actor!.roles?.roles_name === "Admin",
                },
                fn
            );

        let product = await runAsBranch(async () =>
            getRepository(Products).findOne({ where: { branch_id: branchId, is_active: true } as any })
        );

        if (!product) {
            const now = Date.now();
            const category = await runAsBranch(async () =>
                getRepository(Category).save({
                    branch_id: branchId,
                    category_name: `it-serving-cat-${now}`,
                    display_name: `IT SERVING CAT ${now}`,
                    is_active: true,
                } as any)
            );

            const unit = await runAsBranch(async () =>
                getRepository(ProductsUnit).save({
                    branch_id: branchId,
                    unit_name: `it-serving-unit-${now}`,
                    display_name: `IT SERVING UNIT ${now}`,
                    is_active: true,
                } as any)
            );

            product = await runAsBranch(async () =>
                getRepository(Products).save({
                    branch_id: branchId,
                    product_name: `it-serving-product-${now}`,
                    display_name: `IT SERVING PRODUCT ${now}`,
                    description: "integration test product",
                    price: 90,
                    price_delivery: 90,
                    cost: 30,
                    category_id: category.id,
                    unit_id: unit.id,
                    is_active: true,
                } as any)
            );
        }

        let paymentMethod = await runAsBranch(async () =>
            getRepository(PaymentMethod).findOne({
                where: { branch_id: branchId, is_active: true } as any,
                order: { create_date: "ASC" },
            })
        );

        if (!paymentMethod) {
            const now = Date.now();
            paymentMethod = await runAsBranch(async () =>
                getRepository(PaymentMethod).save({
                    branch_id: branchId,
                    payment_method_name: `IT_SERVE_PM_${now}`,
                    display_name: `IT SERVE PM ${now}`,
                    is_active: true,
                } as any)
            );
        }

        await runAsBranch(async () => {
            await shiftsService.openShift(userId, 0, branchId);
        });

        const suffix = `${Date.now()}`;
        const round1Notes = [`it-sb-r1a-${suffix}`, `it-sb-r1b-${suffix}`];
        const round2Notes = [`it-sb-r2a-${suffix}`, `it-sb-r2b-${suffix}`];

        const order = await runAsBranch(async () =>
            ordersService.createFullOrder(
                {
                    branch_id: branchId,
                    created_by_id: userId,
                    order_type: OrderType.TakeAway,
                    status: OrderStatus.Pending,
                    items: [
                        { product_id: product!.id, quantity: 1, notes: round1Notes[0] },
                        { product_id: product!.id, quantity: 2, notes: round1Notes[1] },
                    ],
                },
                branchId
            )
        );

        await runAsBranch(async () =>
            ordersService.addItems(
                order.id,
                [
                    { product_id: product!.id, quantity: 1, notes: round2Notes[0] },
                    { product_id: product!.id, quantity: 1, notes: round2Notes[1] },
                ],
                branchId
            )
        );

        const boardAfterAdd = await runAsBranch(async () => ordersService.getServingBoard(branchId));
        const orderGroups = boardAfterAdd.filter((group) => group.order_id === order.id);
        expect(orderGroups).toHaveLength(2);

        const firstRoundGroup = orderGroups.find((group) =>
            group.items.some((item) => item.notes === round1Notes[0])
        );
        const secondRoundGroup = orderGroups.find((group) =>
            group.items.some((item) => item.notes === round2Notes[0])
        );

        expect(firstRoundGroup?.id).toBeTruthy();
        expect(secondRoundGroup?.id).toBeTruthy();
        expect(firstRoundGroup?.id).not.toBe(secondRoundGroup?.id);
        expect(firstRoundGroup?.total_items).toBe(2);
        expect(firstRoundGroup?.pending_count).toBe(2);
        expect(secondRoundGroup?.total_items).toBe(2);
        expect(secondRoundGroup?.pending_count).toBe(2);

        const secondRoundItemId = secondRoundGroup!.items.find((item) => item.notes === round2Notes[0])!.id;
        await runAsBranch(async () =>
            ordersService.updateServingItemStatus(secondRoundItemId, ServingStatus.Served, branchId)
        );

        let boardAfterItemServe = await runAsBranch(async () => ordersService.getServingBoard(branchId));
        const secondRoundAfterItemServe = boardAfterItemServe.find((group) => group.id === secondRoundGroup!.id);
        expect(secondRoundAfterItemServe?.served_count).toBe(1);
        expect(secondRoundAfterItemServe?.pending_count).toBe(1);
        expect(
            secondRoundAfterItemServe?.items.find((item) => item.id === secondRoundItemId)?.serving_status
        ).toBe(ServingStatus.Served);

        await runAsBranch(async () =>
            ordersService.updateServingGroupStatus(firstRoundGroup!.id, ServingStatus.Served, branchId)
        );

        let boardAfterGroupServe = await runAsBranch(async () => ordersService.getServingBoard(branchId));
        const firstRoundAfterServeAll = boardAfterGroupServe.find((group) => group.id === firstRoundGroup!.id);
        expect(firstRoundAfterServeAll?.served_count).toBe(2);
        expect(firstRoundAfterServeAll?.pending_count).toBe(0);

        await runAsBranch(async () =>
            ordersService.updateServingGroupStatus(firstRoundGroup!.id, ServingStatus.PendingServe, branchId)
        );

        let boardAfterUndoAll = await runAsBranch(async () => ordersService.getServingBoard(branchId));
        const firstRoundAfterUndo = boardAfterUndoAll.find((group) => group.id === firstRoundGroup!.id);
        expect(firstRoundAfterUndo?.served_count).toBe(0);
        expect(firstRoundAfterUndo?.pending_count).toBe(2);

        const orderBeforePayment = await runAsBranch(async () => ordersService.findOne(order.id, branchId));
        expect(orderBeforePayment?.total_amount).toBeTruthy();

        await runAsBranch(async () =>
            paymentsService.create(
                {
                    branch_id: branchId,
                    order_id: order.id,
                    payment_method_id: paymentMethod!.id,
                    amount: Number(orderBeforePayment!.total_amount),
                    amount_received: Number(orderBeforePayment!.total_amount),
                    status: PaymentStatus.Success,
                } as any,
                userId,
                branchId
            )
        );

        const boardAfterPayment = await runAsBranch(async () => ordersService.getServingBoard(branchId));
        expect(boardAfterPayment.some((group) => group.order_id === order.id)).toBe(false);

        await runAsBranch(async () => {
            await AppDataSource.query(`DELETE FROM payments WHERE order_id = $1`, [order.id]);
            await AppDataSource.query(`DELETE FROM order_queue WHERE order_id = $1`, [order.id]);
            await AppDataSource.query(
                `DELETE FROM sales_order_detail WHERE orders_item_id IN (SELECT id FROM sales_order_item WHERE order_id = $1)`,
                [order.id]
            );
            await AppDataSource.query(`DELETE FROM sales_order_item WHERE order_id = $1`, [order.id]);
            await AppDataSource.query(`DELETE FROM sales_orders WHERE id = $1`, [order.id]);
        });
    }, 120000);
});
