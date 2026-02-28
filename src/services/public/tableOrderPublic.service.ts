import { Category } from "../../entity/pos/Category";
import { OrderStatus, OrderType } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { Tables } from "../../entity/pos/Tables";
import { getRepository, runInTransaction, runWithDbContext } from "../../database/dbContext";
import { AppError } from "../../utils/AppError";
import { OrdersModels } from "../../models/pos/orders.model";
import { OrdersService } from "../pos/orders.service";
import { EntityManager } from "typeorm";
import { SocketService } from "../socket.service";
import { buildPublicOrderRealtimePayload } from "../../utils/publicRealtime";
import { RealtimeEvents } from "../../utils/realtimeEvents";

type PublicOrderItemInput = {
    product_id: string;
    quantity: number;
    notes?: string;
};

type SubmitOrderInput = {
    items: PublicOrderItemInput[];
    customer_note?: string;
};

const ACTIVE_VIEW_STATUSES: string[] = [
    OrderStatus.Pending,
    OrderStatus.pending,
    OrderStatus.Cooking,
    OrderStatus.Served,
    OrderStatus.WaitingForPayment,
];

export class PublicTableOrderService {
    private ordersService = new OrdersService(new OrdersModels());
    private socketService = SocketService.getInstance();

    private getSalesOrderRepository(manager?: EntityManager) {
        return manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
    }

    private async resolveTableByToken(token: string): Promise<Tables> {
        const table = await runWithDbContext(
            {
                isAdmin: true,
                userId: "public-table-order",
                role: "public",
            },
            async () => {
                return getRepository(Tables)
                    .createQueryBuilder("tables")
                    .where("tables.qr_code_token = :token", { token })
                    .andWhere("tables.is_active = true")
                    .andWhere("(tables.qr_code_expires_at IS NULL OR tables.qr_code_expires_at > NOW())")
                    .getOne();
            },
        );

        if (!table || !table.branch_id) {
            throw new AppError("Table QR is invalid or expired", 404);
        }

        return table;
    }

    private canAddItemsToOrder(status: string | undefined | null): boolean {
        const normalized = String(status || "").trim().toLowerCase();
        return normalized === "pending" || normalized === "cooking" || normalized === "served";
    }

    private async findLatestOrderForTable(
        tableId: string,
        branchId: string,
        statuses: string[],
        manager?: EntityManager,
    ): Promise<SalesOrder | null> {
        return this.getSalesOrderRepository(manager)
            .createQueryBuilder("order")
            .leftJoinAndSelect("order.items", "items")
            .leftJoinAndSelect("items.product", "product")
            .leftJoinAndSelect("items.details", "details")
            .where("order.table_id = :tableId", { tableId })
            .andWhere("order.branch_id = :branchId", { branchId })
            .andWhere("order.status IN (:...statuses)", { statuses })
            .orderBy("order.create_date", "DESC")
            .getOne();
    }

    private async findLatestOrderHeaderForTable(
        tableId: string,
        branchId: string,
        statuses: string[],
        manager?: EntityManager,
    ): Promise<SalesOrder | null> {
        return this.getSalesOrderRepository(manager)
            .createQueryBuilder("order")
            .where("order.table_id = :tableId", { tableId })
            .andWhere("order.branch_id = :branchId", { branchId })
            .andWhere("order.status IN (:...statuses)", { statuses })
            .orderBy("order.create_date", "DESC")
            .getOne();
    }

    private assertNoCustomerModifiers(items: unknown[]): void {
        const hasDetails = items.some(
            (item) =>
                item &&
                typeof item === "object" &&
                Object.prototype.hasOwnProperty.call(item as Record<string, unknown>, "details"),
        );

        if (hasDetails) {
            throw new AppError("QR ordering supports notes only. Modifiers are not allowed.", 400);
        }
    }

    private async assertProductsAvailableForPublicOrder(
        branchId: string,
        items: PublicOrderItemInput[],
        manager?: EntityManager,
    ): Promise<void> {
        const productIds = Array.from(
            new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
        );

        if (productIds.length === 0) {
            throw new AppError("Please add at least one item", 400);
        }

        const productRepo = manager ? manager.getRepository(Products) : getRepository(Products);

        const rows = await productRepo
            .createQueryBuilder("product")
            .leftJoin("product.category", "category")
            .select("product.id", "id")
            .where("product.branch_id = :branchId", { branchId })
            .andWhere("product.is_active = true")
            .andWhere("category.is_active = true")
            .andWhere("product.id IN (:...productIds)", { productIds })
            .getRawMany<{ id: string }>();

        if (rows.length !== productIds.length) {
            throw new AppError("Some items are unavailable. Please refresh menu and try again.", 409);
        }
    }

    private mapOrderItem(item: SalesOrderItem) {
        return {
            id: item.id,
            product_id: item.product_id,
            product_name: item.product?.display_name || item.product?.product_name || "-",
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            total_price: Number(item.total_price || 0),
            status: item.status,
            notes: item.notes || "",
            details: Array.isArray(item.details)
                ? item.details.map((detail) => ({
                    id: detail.id,
                    detail_name: detail.detail_name,
                    extra_price: Number(detail.extra_price || 0),
                }))
                : [],
        };
    }

    private mapOrder(order: SalesOrder | null) {
        if (!order) {
            return null;
        }

        return {
            id: order.id,
            order_no: order.order_no,
            status: order.status,
            order_type: order.order_type,
            total_amount: Number(order.total_amount || 0),
            sub_total: Number(order.sub_total || 0),
            discount_amount: Number(order.discount_amount || 0),
            vat: Number(order.vat || 0),
            create_date: order.create_date,
            update_date: order.update_date,
            can_add_items: this.canAddItemsToOrder(String(order.status || "")),
            items: Array.isArray(order.items) ? order.items.map((item) => this.mapOrderItem(item)) : [],
        };
    }

    private async loadMenu(branchId: string) {
        const categories = await getRepository(Category)
            .createQueryBuilder("category")
            .where("category.branch_id = :branchId", { branchId })
            .andWhere("category.is_active = true")
            .orderBy("category.display_name", "ASC")
            .getMany();

        const products = await getRepository(Products)
            .createQueryBuilder("product")
            .leftJoinAndSelect("product.category", "category")
            .leftJoinAndSelect("product.unit", "unit")
            .where("product.branch_id = :branchId", { branchId })
            .andWhere("product.is_active = true")
            .andWhere("category.is_active = true")
            .orderBy("category.display_name", "ASC")
            .addOrderBy("product.display_name", "ASC")
            .getMany();

        const categoryMap = new Map(
            categories.map((category) => [
                category.id,
                {
                    id: category.id,
                    category_name: category.category_name,
                    display_name: category.display_name,
                    items: [] as Array<{
                        id: string;
                        category_id: string;
                        display_name: string;
                        description: string;
                        price: number;
                        img_url: string | null;
                        unit_name: string | null;
                    }>,
                },
            ]),
        );

        for (const product of products) {
            if (!categoryMap.has(product.category_id)) {
                categoryMap.set(product.category_id, {
                    id: product.category_id,
                    category_name: product.category?.category_name || "",
                    display_name: product.category?.display_name || "Uncategorized",
                    items: [],
                });
            }

            const category = categoryMap.get(product.category_id)!;
            category.items.push({
                id: product.id,
                category_id: product.category_id,
                display_name: product.display_name,
                description: product.description || "",
                price: Number(product.price || 0),
                img_url: product.img_url || null,
                unit_name: product.unit?.display_name || product.unit?.unit_name || null,
            });
        }

        return Array.from(categoryMap.values()).filter((category) => category.items.length > 0);
    }

    private toOrderItemsInput(items: PublicOrderItemInput[]) {
        return items.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            discount_amount: 0,
            notes: typeof item.notes === "string" ? item.notes.trim() : "",
            status: OrderStatus.Pending,
            details: [],
        }));
    }

    private withSuppressedPublicRealtime<T>(manager: EntityManager, fn: () => Promise<T>): Promise<T> {
        const queryRunner = manager.queryRunner;
        if (!queryRunner) {
            return fn();
        }

        const previousData = queryRunner.data ?? {};
        queryRunner.data = {
            ...previousData,
            suppressPublicTableRealtime: true,
        };

        return fn().finally(() => {
            queryRunner.data = previousData;
        });
    }

    async getBootstrapByToken(token: string) {
        const table = await this.resolveTableByToken(token);

        return runWithDbContext(
            {
                branchId: table.branch_id,
                userId: "public-table-order",
                role: "public",
                isAdmin: false,
            },
            async () => {
                const [menu, activeOrder] = await Promise.all([
                    this.loadMenu(table.branch_id!),
                    this.findLatestOrderForTable(table.id, table.branch_id!, ACTIVE_VIEW_STATUSES),
                ]);

                return {
                    table: {
                        id: table.id,
                        table_name: table.table_name,
                    },
                    menu,
                    active_order: this.mapOrder(activeOrder),
                    policy: {
                        can_customer_cancel: false,
                        can_customer_pay: false,
                        refund_supported: false,
                    },
                };
            },
        );
    }

    async getActiveOrderByToken(token: string) {
        const table = await this.resolveTableByToken(token);

        return runWithDbContext(
            {
                branchId: table.branch_id,
                userId: "public-table-order",
                role: "public",
                isAdmin: false,
            },
            async () => {
                const activeOrder = await this.findLatestOrderForTable(table.id, table.branch_id!, ACTIVE_VIEW_STATUSES);
                return {
                    table: {
                        id: table.id,
                        table_name: table.table_name,
                    },
                    active_order: this.mapOrder(activeOrder),
                    policy: {
                        can_customer_cancel: false,
                        can_customer_pay: false,
                        refund_supported: false,
                    },
                };
            },
        );
    }

    async submitByToken(token: string, payload: SubmitOrderInput) {
        const table = await this.resolveTableByToken(token);
        const branchId = table.branch_id!;
        const rawItems = Array.isArray((payload as { items?: unknown[] })?.items)
            ? ((payload as { items: unknown[] }).items ?? [])
            : [];

        if (rawItems.length === 0) {
            throw new AppError("Please add at least one item", 400);
        }

        this.assertNoCustomerModifiers(rawItems);

        const normalizedItems = this.toOrderItemsInput(payload.items || []);

        return runWithDbContext(
            {
                branchId,
                userId: "public-table-order",
                role: "public",
                isAdmin: false,
            },
            async () => {
                const result = await runInTransaction(async (manager) => {
                    const lockedTable = await manager
                        .getRepository(Tables)
                        .createQueryBuilder("tables")
                        .where("tables.id = :tableId", { tableId: table.id })
                        .andWhere("tables.branch_id = :branchId", { branchId })
                        .setLock("pessimistic_write")
                        .getOne();

                    if (!lockedTable) {
                        throw new AppError("Table QR is invalid or expired", 404);
                    }

                    await this.assertProductsAvailableForPublicOrder(branchId, normalizedItems, manager);

                    const latestOrder = await this.findLatestOrderHeaderForTable(
                        table.id,
                        branchId,
                        ACTIVE_VIEW_STATUSES,
                        manager,
                    );

                    if (latestOrder && !this.canAddItemsToOrder(String(latestOrder.status || ""))) {
                        throw new AppError("ไม่สามารถสั่งของได้", 409);
                    }

                    if (latestOrder && this.canAddItemsToOrder(String(latestOrder.status || ""))) {
                        const refreshed = await this.withSuppressedPublicRealtime(manager, async () => {
                            let updatedOrder: SalesOrder | null = latestOrder;
                            for (const item of normalizedItems) {
                                updatedOrder = await this.ordersService.addItem(latestOrder.id, item, branchId);
                            }

                            return (await this.ordersService.findOne(latestOrder.id, branchId)) || updatedOrder;
                        });

                        return {
                            response: {
                                mode: "append",
                                table: {
                                    id: table.id,
                                    table_name: table.table_name,
                                },
                                order: this.mapOrder(refreshed),
                            },
                            realtime: {
                                event: RealtimeEvents.orders.update,
                                payload: buildPublicOrderRealtimePayload(table.id, "update", latestOrder.id),
                            },
                        };
                    }

                    const created = await this.withSuppressedPublicRealtime(manager, () =>
                        this.ordersService.createFullOrder(
                            {
                                order_type: OrderType.DineIn,
                                table_id: table.id,
                                status: OrderStatus.Pending,
                                sub_total: 0,
                                discount_amount: 0,
                                vat: 0,
                                total_amount: 0,
                                received_amount: 0,
                                change_amount: 0,
                                items: normalizedItems,
                            },
                            branchId,
                        )
                    );

                    const refreshed = await this.ordersService.findOne(created.id, branchId);

                    return {
                        response: {
                            mode: "create",
                            table: {
                                id: table.id,
                                table_name: table.table_name,
                            },
                            order: this.mapOrder(refreshed || created),
                        },
                        realtime: {
                            event: RealtimeEvents.orders.create,
                            payload: buildPublicOrderRealtimePayload(table.id, "create", created.id),
                        },
                    };
                });

                this.socketService.emitToPublicTable(table.id, result.realtime.event, result.realtime.payload);
                return result.response;
            },
        );
    }

    async resolveOrderByToken(token: string, orderId: string) {
        const table = await this.resolveTableByToken(token);

        return runWithDbContext(
            {
                branchId: table.branch_id,
                userId: "public-table-order",
                role: "public",
                isAdmin: false,
            },
            async () => {
                const order = await this.ordersService.findOne(orderId, table.branch_id);
                if (!order || order.table_id !== table.id) {
                    throw new AppError("Order not found for this table", 404);
                }
                return {
                    table: {
                        id: table.id,
                        table_name: table.table_name,
                    },
                    order: this.mapOrder(order),
                };
            },
        );
    }
}
