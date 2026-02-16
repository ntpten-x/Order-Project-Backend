import { OrdersModels } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, queryCache, invalidateCache } from "../../utils/cache";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { Delivery } from "../../entity/pos/Delivery";
import { Discounts } from "../../entity/pos/Discounts";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { OrderStatus, OrderType } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { EntityManager, In } from "typeorm";
import { recalculateOrderTotal } from "./orderTotals.service";
import { AppError } from "../../utils/AppError";
import { ShiftsService } from "./shifts.service";
import { OrderQueueService } from "./orderQueue.service";
import { QueuePriority, QueueStatus, OrderQueue } from "../../entity/pos/OrderQueue";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getDbContext, getRepository, runInTransaction } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { normalizeOrderStatus } from "../../utils/orderStatus";
import { metrics } from "../../utils/metrics";
import { PermissionScope } from "../../middleware/permission.middleware";
import { CreatedSort } from "../../utils/sortCreated";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

export class OrdersService {
    private socketService = SocketService.getInstance();
    private shiftsService = new ShiftsService();
    private queueService = new OrderQueueService();
    private readonly SUMMARY_CACHE_PREFIX = "orders:summary";
    private readonly SUMMARY_CACHE_TTL = Number(process.env.ORDERS_SUMMARY_CACHE_TTL_MS || 10000);
    private readonly STATS_CACHE_PREFIX = "orders:stats";
    private readonly STATS_CACHE_TTL = Number(process.env.ORDERS_STATS_CACHE_TTL_MS || 10000);

    constructor(private ordersModel: OrdersModels) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private observeCache(operation: string, result: "hit" | "miss", source?: "memory" | "redis"): void {
        metrics.observeCache({
            cache: "query",
            operation,
            result,
            source: source ?? "none",
        });
    }

    private invalidateReadCaches(branchId?: string): void {
        const scope = this.getCacheScopeParts(branchId);
        const patterns = [
            cacheKey(this.SUMMARY_CACHE_PREFIX, ...scope),
            cacheKey(this.STATS_CACHE_PREFIX, ...scope),
            cacheKey("dashboard:sales", ...scope),
            cacheKey("dashboard:top-items", ...scope),
        ];
        invalidateCache(patterns);
    }

    private async ensureActiveShift(branchId?: string): Promise<void> {
        const activeShift = await this.shiftsService.getCurrentShift(branchId);
        if (!activeShift) {
            throw new AppError("กรุณาเปิดกะก่อนทำรายการ (Active Shift Required)", 400);
        }
    }

    private async ensureOrderNo(orderNo?: string): Promise<string> {
        if (orderNo) return orderNo;
        for (let i = 0; i < 5; i++) {
            const now = new Date();
            const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
            const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
            const rand = Math.floor(1000 + Math.random() * 9000);
            const candidate = `ORD-${datePart}-${timePart}-${rand}`;
            const existing = await this.ordersModel.findOneByOrderNo(candidate);
            if (!existing) return candidate;
        }
        throw new AppError("Unable to generate order number", 500);
    }

    private async prepareItems(
        items: any[],
        manager: EntityManager,
        branchId?: string,
        orderType?: OrderType
    ): Promise<Array<{ item: SalesOrderItem; details: SalesOrderDetail[] }>> {
        const productRepo = manager.getRepository(Products);

        // 1. Collect all product IDs
        const productIds = items
            .map(i => i.product_id)
            .filter((id): id is string => !!id);

        if (productIds.length === 0) {
            throw new AppError("ไม่มีรายการสินค้าในคำสั่งซื้อ", 400);
        }

        // 2. Optimization: Batch Fetch Products (Single Query)
        // Instead of querying N times inside the loop
        const where: any = {
            id: In(productIds),
            is_active: true
        };

        if (branchId) {
            where.branch_id = branchId;
        }

        const products = await productRepo.findBy(where);

        // 3. Create Map for O(1) Lookup
        const productMap = new Map(products.map(p => [p.id, p]));

        const prepared: Array<{ item: SalesOrderItem; details: SalesOrderDetail[] }> = [];

        for (const itemData of items) {
            if (!itemData?.product_id) {
                throw new AppError("Missing product_id", 400);
            }

            // Lookup from memory instead of DB
            const product = productMap.get(itemData.product_id);

            if (!product) {
                throw new AppError(`Product not found or inactive`, 404);
            }

            const quantity = Number(itemData.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new AppError("Invalid quantity", 400);
            }

            const discount = Number(itemData.discount_amount || 0);
            if (discount < 0) {
                throw new AppError("Invalid discount amount", 400);
            }

            const detailsData = Array.isArray(itemData.details) ? itemData.details : [];
            const detailsTotal = detailsData.reduce((sum: number, d: any) => sum + (Number(d?.extra_price) || 0), 0);

            const unitPrice =
                orderType === OrderType.Delivery
                    ? Number((product as any).price_delivery ?? product.price)
                    : Number(product.price);
            const lineTotal = (unitPrice + detailsTotal) * quantity - discount;

            const item = new SalesOrderItem();
            item.product_id = product.id;
            item.quantity = quantity;
            item.price = unitPrice;
            item.discount_amount = discount;
            item.total_price = Math.max(0, Number(lineTotal));
            item.notes = itemData.notes;
            item.status = itemData.status || OrderStatus.Pending;

            const details: SalesOrderDetail[] = detailsData.map((d: any) => {
                const detail = new SalesOrderDetail();
                detail.detail_name = d?.detail_name ?? "";
                detail.extra_price = Number(d?.extra_price || 0);
                return detail;
            });

            prepared.push({ item, details });
        }

        return prepared;
    }

    private ensureValidStatus(status: string): OrderStatus {
        try {
            // Accept legacy values but always normalize to canonical casing.
            return normalizeOrderStatus(status);
        } catch {
            throw new AppError("Invalid status", 400);
        }
    }

    async findAll(
        page: number,
        limit: number,
        statuses?: string[],
        type?: string,
        query?: string,
        branchId?: string,
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: SalesOrder[], total: number, page: number, limit: number }> {
        try {
            return this.ordersModel.findAll(page, limit, statuses, type, query, branchId, access, sortCreated)
        } catch (error) {
            throw error
        }
    }

    async findAllSummary(
        page: number,
        limit: number,
        statuses?: string[],
        type?: string,
        query?: string,
        branchId?: string,
        access?: AccessContext,
        options?: { bypassCache?: boolean },
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: any[], total: number, page: number, limit: number }> {
        const statusKey = statuses?.length ? statuses.join(",") : "all";
        const typeKey = type || "all";
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.SUMMARY_CACHE_PREFIX, ...scope, "list", page, limit, statusKey, typeKey, sortCreated);

        if (options?.bypassCache || query?.trim() || page > 1) {
            return this.ordersModel.findAllSummary(page, limit, statuses, type, query, branchId, access, sortCreated);
        }

        return withCache(
            key,
            () => this.ordersModel.findAllSummary(page, limit, statuses, type, query, branchId, access, sortCreated),
            this.SUMMARY_CACHE_TTL,
            queryCache as any,
            {
                onHit: (source) => this.observeCache("orders.summary.list", "hit", source),
                onMiss: () => this.observeCache("orders.summary.list", "miss"),
            }
        );
    }

    async getStats(branchId?: string, access?: AccessContext, options?: { bypassCache?: boolean }): Promise<{ dineIn: number, takeaway: number, delivery: number, total: number }> {
        const activeStatuses = [
            OrderStatus.Pending,
            OrderStatus.Cooking,
            OrderStatus.Served,
            OrderStatus.WaitingForPayment,
        ];

        if (options?.bypassCache) {
            return this.ordersModel.getStats(activeStatuses, branchId, access);
        }

        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.STATS_CACHE_PREFIX, ...scope, "active");

        return withCache(
            key,
            () => this.ordersModel.getStats(activeStatuses, branchId, access),
            this.STATS_CACHE_TTL,
            queryCache as any,
            {
                onHit: (source) => this.observeCache("orders.stats.active", "hit", source),
                onMiss: () => this.observeCache("orders.stats.active", "miss"),
            }
        );
    }

    async findAllItems(
        status?: string,
        page: number = 1,
        limit: number = 100,
        branchId?: string,
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: SalesOrderItem[]; total: number; page: number; limit: number }> {
        return this.ordersModel.findAllItems(status, page, limit, branchId, access, sortCreated);
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrder | null> {
        try {
            return this.ordersModel.findOne(id, branchId, access)
        } catch (error) {
            throw error
        }
    }

    async create(orders: SalesOrder, branchId?: string): Promise<SalesOrder> {
        await this.ensureActiveShift(orders.branch_id || branchId);
        return await runInTransaction(async (manager) => {
            try {
                if (orders.order_no) {
                    const existingOrder = await this.ordersModel.findOneByOrderNo(orders.order_no)
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
                    }
                } else {
                    orders.order_no = await this.ensureOrderNo();
                }

                const effectiveBranchId = orders.branch_id || branchId;

                // Validate foreign keys to prevent cross-branch access
                if (effectiveBranchId) {
                    if (orders.table_id) {
                        const table = await manager.getRepository(Tables).findOneBy({ id: orders.table_id, branch_id: effectiveBranchId } as any);
                        if (!table) throw new AppError("Table not found for this branch", 404);
                    }

                    if (orders.delivery_id) {
                        const delivery = await manager.getRepository(Delivery).findOneBy({ id: orders.delivery_id, branch_id: effectiveBranchId } as any);
                        if (!delivery) throw new AppError("Delivery not found for this branch", 404);
                    }

                    if (orders.discount_id) {
                        const discount = await manager.getRepository(Discounts).findOneBy({ id: orders.discount_id, branch_id: effectiveBranchId } as any);
                        if (!discount) throw new AppError("Discount not found for this branch", 404);
                    }
                }

                // Pass manager to create which uses it for repository
                const createdOrder = await this.ordersModel.create(orders, manager)

                // Update Table Status if DineIn
                if (createdOrder.table_id) {
                    const tablesRepo = manager.getRepository(Tables)
                    await tablesRepo.update(createdOrder.table_id, { status: TableStatus.Unavailable })
                }
                return createdOrder;
            } catch (error) {
                throw error
            }
        }).then(async (createdOrder) => {
            this.invalidateReadCaches(createdOrder.branch_id || branchId);
            // Post-transaction Side Effects
            const effectiveBranchId = createdOrder.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.create, createdOrder);
            }
            if (createdOrder.table_id) {
                const tablesRepo = getRepository(Tables)
                tablesRepo.findOneBy({ id: createdOrder.table_id }).then(t => {
                    if (!t) return;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, t);
                    }
                })
            }

            // Auto-add to queue if order is pending
            if (createdOrder.status === OrderStatus.Pending) {
                try {
                    await this.queueService.addToQueue(
                        createdOrder.id,
                        QueuePriority.Normal,
                        createdOrder.branch_id
                    );
                } catch (error) {
                    // Log but don't fail if queue add fails (might already be in queue)
                    console.warn('Failed to add order to queue:', error);
                }
            }

            return createdOrder
        })
    }

    async createFullOrder(data: any, branchId?: string): Promise<SalesOrder> {
        const { items, ...orderData } = data;
        await this.ensureActiveShift(orderData.branch_id || branchId);
        return await runInTransaction(async (manager) => {

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new AppError("กรุณาระบุรายการสินค้า", 400);
            }

            if (orderData.order_no) {
                const existingOrder = await this.ordersModel.findOneByOrderNo(orderData.order_no)
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
                }
            } else {
                orderData.order_no = await this.ensureOrderNo();
            }

            if (!orderData.status) {
                orderData.status = OrderStatus.Pending;
            }

            const effectiveBranchId = orderData.branch_id || branchId;

            // Validate foreign keys to prevent cross-branch access
            if (effectiveBranchId) {
                if (orderData.table_id) {
                    const table = await manager.getRepository(Tables).findOneBy({ id: orderData.table_id, branch_id: effectiveBranchId } as any);
                    if (!table) throw new AppError("Table not found for this branch", 404);
                }

                if (orderData.delivery_id) {
                    const delivery = await manager.getRepository(Delivery).findOneBy({ id: orderData.delivery_id, branch_id: effectiveBranchId } as any);
                    if (!delivery) throw new AppError("Delivery not found for this branch", 404);
                }

                if (orderData.discount_id) {
                    const discount = await manager.getRepository(Discounts).findOneBy({ id: orderData.discount_id, branch_id: effectiveBranchId } as any);
                    if (!discount) throw new AppError("Discount not found for this branch", 404);
                }
            }

            const preparedItems = await this.prepareItems(items, manager, branchId, orderData.order_type);

            const orderRepo = manager.getRepository(SalesOrder);
            const itemRepo = manager.getRepository(SalesOrderItem);
            const detailRepo = manager.getRepository(SalesOrderDetail);

            const savedOrder = await orderRepo.save(orderData);

            if (savedOrder.table_id) {
                const tablesRepo = manager.getRepository(Tables)
                await tablesRepo.update(savedOrder.table_id, { status: TableStatus.Unavailable })
            }

            for (const prepared of preparedItems) {
                prepared.item.order_id = savedOrder.id;
                const savedItem = await itemRepo.save(prepared.item);

                if (prepared.details.length > 0) {
                    for (const detail of prepared.details) {
                        detail.orders_item_id = savedItem.id;
                        await detailRepo.save(detail);
                    }
                }
            }

            await recalculateOrderTotal(savedOrder.id, manager);
            return savedOrder;
        }).then(async (savedOrder) => {
            const fullOrder = await this.ordersModel.findOne(savedOrder.id, branchId);
            if (fullOrder) {
                this.invalidateReadCaches(fullOrder.branch_id || branchId);
                const effectiveBranchId = fullOrder.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.create, fullOrder);
                }
                if (fullOrder.table_id) {
                    const tablesRepo = getRepository(Tables)
                    const t = await tablesRepo.findOneBy({ id: fullOrder.table_id })
                    if (t) {
                        if (effectiveBranchId) {
                            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, t);
                        }
                    }
                }

                // Auto-add to queue if order is pending
                if (fullOrder.status === OrderStatus.Pending) {
                    try {
                        await this.queueService.addToQueue(
                            fullOrder.id,
                            QueuePriority.Normal,
                            fullOrder.branch_id
                        );
                    } catch (error) {
                        // Log but don't fail if queue add fails (might already be in queue)
                        console.warn('Failed to add order to queue:', error);
                    }
                }

                return fullOrder;
            }
            return savedOrder;
        })
    }

    async update(id: string, orders: SalesOrder, branchId?: string): Promise<SalesOrder> {
        try {
            const orderToUpdate = await this.ordersModel.findOne(id, branchId)
            if (!orderToUpdate) {
                throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการแก้ไข")
            }

            const effectiveBranchId = orderToUpdate.branch_id || branchId;

            // Validate foreign keys to prevent cross-branch access
            if (effectiveBranchId) {
                if (orders.table_id !== undefined && orders.table_id !== null) {
                    const table = await getRepository(Tables).findOneBy({ id: orders.table_id as any, branch_id: effectiveBranchId } as any);
                    if (!table) throw new AppError("Table not found for this branch", 404);
                }

                if (orders.delivery_id !== undefined && orders.delivery_id !== null) {
                    const delivery = await getRepository(Delivery).findOneBy({ id: orders.delivery_id as any, branch_id: effectiveBranchId } as any);
                    if (!delivery) throw new AppError("Delivery not found for this branch", 404);
                }

                if (orders.discount_id !== undefined && orders.discount_id !== null) {
                    const discount = await getRepository(Discounts).findOneBy({ id: orders.discount_id as any, branch_id: effectiveBranchId } as any);
                    if (!discount) throw new AppError("Discount not found for this branch", 404);
                }
            }

            if (orders.order_no && orders.order_no !== orderToUpdate.order_no) {
                const existingOrder = await this.ordersModel.findOneByOrderNo(orders.order_no, effectiveBranchId)
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว")
                }
            }

            if (orders.status) {
                this.ensureValidStatus(String(orders.status));
            }

            const updatedOrder = await this.ordersModel.update(id, orders, undefined, branchId)

            if (orders.status) {
                const normalizedStatus = this.ensureValidStatus(String(orders.status));
                if (normalizedStatus === OrderStatus.Cancelled) {
                    await this.ordersModel.updateAllItemsStatus(id, OrderStatus.Cancelled);
                }
            }

            await recalculateOrderTotal(id);

            const refreshedOrder = await this.ordersModel.findOne(id, branchId);
            const result = refreshedOrder ?? updatedOrder;

            const finalStatus = (orders.status as OrderStatus) ?? result.status;
            // Release table if Order is Completed or Cancelled
            if ((finalStatus === OrderStatus.Completed || finalStatus === OrderStatus.Cancelled) && result.table_id) {
                const tablesRepo = getRepository(Tables);
                await tablesRepo.update(result.table_id, { status: TableStatus.Available });
                const t = await tablesRepo.findOneBy({ id: result.table_id });
                if (t) {
                    const effectiveBranchId = result.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, t);
                    }
                }
            }

            // Update queue status based on order status
            try {
                const queueRepo = getRepository(OrderQueue);
                const queueItem = await queueRepo.findOne({ where: { order_id: result.id } });

                if (queueItem) {
                    if (finalStatus === OrderStatus.Cooking) {
                        await this.queueService.updateStatus(queueItem.id, QueueStatus.Processing, branchId);
                    } else if (finalStatus === OrderStatus.Completed || finalStatus === OrderStatus.Cancelled) {
                        await this.queueService.updateStatus(queueItem.id, finalStatus === OrderStatus.Completed
                            ? QueueStatus.Completed
                            : QueueStatus.Cancelled, branchId);
                    }
                }
            } catch (error) {
                // Log but don't fail if queue update fails
                console.warn('Failed to update queue status:', error);
            }

            const emitBranchId = result.branch_id || branchId;
            this.invalidateReadCaches(emitBranchId);
            if (emitBranchId) {
                this.socketService.emitToBranch(emitBranchId, RealtimeEvents.orders.update, result);
            }
            return result
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const order = await this.ordersModel.findOne(id, branchId);
            if (!order) {
                throw new AppError("Order not found", 404);
            }
            if (order?.table_id) {
                const tablesRepo = getRepository(Tables);
                await tablesRepo.update(order.table_id, { status: TableStatus.Available });
                const t = await tablesRepo.findOneBy({ id: order.table_id });
                if (t) {
                    const effectiveBranchId = order.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, t);
                    }
                }
            }
            await this.ordersModel.delete(id, undefined, branchId)
            const effectiveBranchId = order?.branch_id || branchId;
            this.invalidateReadCaches(effectiveBranchId);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.delete, { id });
            }
        } catch (error) {
            throw error
        }
    }

    async updateItemStatus(itemId: string, status: string, branchId?: string): Promise<void> {
        try {
            const normalized = this.ensureValidStatus(status);
            const item = await this.ordersModel.findItemById(itemId, undefined, branchId);
            if (!item) throw new AppError("Item not found", 404);

            await this.ordersModel.updateItemStatus(itemId, normalized)
            await recalculateOrderTotal(item.order_id);

            const updatedOrder = await this.ordersModel.findOne(item.order_id, branchId);
            if (!updatedOrder) return;

            const effectiveBranchId = updatedOrder.branch_id || branchId;
            this.invalidateReadCaches(effectiveBranchId);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, updatedOrder);
            }
        } catch (error) {
            throw error
        }
    }

    async addItem(orderId: string, itemData: any, branchId?: string): Promise<SalesOrder> {
        return await runInTransaction(async (manager) => {
            try {
                const orderRepo = manager.getRepository(SalesOrder);
                const order = await orderRepo.findOneBy(branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId });
                if (!order) throw new AppError("Order not found", 404);

                const prepared = await this.prepareItems([itemData], manager, branchId, order.order_type);
                const { item, details } = prepared[0];
                item.order_id = orderId;

                const savedItem = await this.ordersModel.createItem(item, manager);

                if (details.length > 0) {
                    const detailRepo = manager.getRepository(SalesOrderDetail);
                    for (const detail of details) {
                        detail.orders_item_id = savedItem.id;
                        await detailRepo.save(detail);
                    }
                }

                await recalculateOrderTotal(orderId, manager);

                const updatedOrder = await this.ordersModel.findOne(orderId, branchId);
                return updatedOrder!;
            } catch (error) {
                throw error;
            }
        }).then((updatedOrder) => {
            if (updatedOrder) {
                const effectiveBranchId = updatedOrder.branch_id || branchId;
                this.invalidateReadCaches(effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, updatedOrder);
                }
            }
            return updatedOrder!;
        })
    }

    async updateItemDetails(itemId: string, data: { quantity?: number, notes?: string, details?: any[] }, branchId?: string): Promise<SalesOrder> {
        return await runInTransaction(async (manager) => {
            try {
                const item = await this.ordersModel.findItemById(itemId, manager, branchId);
                if (!item) throw new Error("Item not found");

                const detailRepo = manager.getRepository(SalesOrderDetail);

                if (data.details !== undefined) {
                    // 1. Delete existing details
                    await detailRepo.delete({ orders_item_id: itemId });

                    // 2. Add new details
                    if (Array.isArray(data.details) && data.details.length > 0) {
                        for (const d of data.details) {
                            if (!d.detail_name && !d.extra_price) continue;
                            const detail = new SalesOrderDetail();
                            detail.orders_item_id = itemId;
                            detail.detail_name = d.detail_name || "";
                            detail.extra_price = Number(d.extra_price || 0);
                            await detailRepo.save(detail);
                        }
                    }
                }

                // Refetch item with new details to get total price right
                const updatedItemWithDetails = await this.ordersModel.findItemById(itemId, manager, branchId);
                if (!updatedItemWithDetails) throw new Error("Item not found after detail update");

                if (data.quantity !== undefined) {
                    const qty = Number(data.quantity);
                    if (!Number.isFinite(qty) || qty <= 0) {
                        throw new AppError("Invalid quantity", 400);
                    }
                    updatedItemWithDetails.quantity = qty;
                }

                if (data.notes !== undefined) {
                    updatedItemWithDetails.notes = data.notes;
                }

                const detailsTotal = updatedItemWithDetails.details ? updatedItemWithDetails.details.reduce((sum: number, d: any) => sum + (Number(d.extra_price) || 0), 0) : 0;
                updatedItemWithDetails.total_price = Math.max(0, (Number(updatedItemWithDetails.price) + detailsTotal) * updatedItemWithDetails.quantity - Number(updatedItemWithDetails.discount_amount || 0));

                await this.ordersModel.updateItem(itemId, {
                    quantity: updatedItemWithDetails.quantity,
                    total_price: updatedItemWithDetails.total_price,
                    notes: updatedItemWithDetails.notes
                }, manager);

                await recalculateOrderTotal(updatedItemWithDetails.order_id, manager);

                const updatedOrder = await this.ordersModel.findOne(updatedItemWithDetails.order_id, branchId);
                return updatedOrder!;
            } catch (error) {
                throw error;
            }
        }).then((updatedOrder) => {
            if (updatedOrder) {
                const effectiveBranchId = updatedOrder.branch_id || branchId;
                this.invalidateReadCaches(effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, updatedOrder);
                }
            }
            return updatedOrder!;
        })
    }

    async deleteItem(itemId: string, branchId?: string): Promise<SalesOrder> {
        return await runInTransaction(async (manager) => {
            try {
                const item = await this.ordersModel.findItemById(itemId, manager, branchId);
                if (!item) throw new Error("Item not found");
                const orderId = item.order_id;

                await this.ordersModel.deleteItem(itemId, manager);

                await recalculateOrderTotal(orderId, manager);

                const updatedOrder = await this.ordersModel.findOne(orderId, branchId);
                return updatedOrder!;
            } catch (error) {
                throw error;
            }
        }).then((updatedOrder) => {
            if (updatedOrder) {
                const effectiveBranchId = updatedOrder.branch_id || branchId;
                this.invalidateReadCaches(effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, updatedOrder);
                }
            }
            return updatedOrder!;
        })
    }
}
