import { OrdersModels, ChannelStats } from "../../models/pos/orders.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, queryCache, invalidateCache } from "../../utils/cache";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { Delivery } from "../../entity/pos/Delivery";
import { Discounts } from "../../entity/pos/Discounts";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { OrderStatus, OrderType, ServingStatus } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { EntityManager, In } from "typeorm";
import { randomUUID } from "crypto";
import { recalculateOrderTotal } from "./orderTotals.service";
import { AppError } from "../../utils/AppError";
import { ShiftsService } from "./shifts.service";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getDbContext, getRepository, runInTransaction } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { normalizeOrderStatus, isCancelledStatus } from "../../utils/orderStatus";
import { metrics } from "../../utils/metrics";
import { PermissionScope } from "../../middleware/permission.middleware";
import { CreatedSort } from "../../utils/sortCreated";
import { groupServingBoardRows, ServingBoardGroup, ServingBoardRow } from "../../utils/servingBoard";
import { getTableCacheInvalidationPatterns } from "./tableCache.utils";
import { getDashboardCacheInvalidationPatterns } from "./dashboardCache.utils";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

type ServingGroupContext = {
    id: string;
    createdAt: Date;
};

type MutatedOrderContext = {
    orderId: string;
    branchId?: string;
    tableIdsToRefresh?: string[];
};

export class OrdersService {
    private socketService = SocketService.getInstance();
    private shiftsService = new ShiftsService();
    private readonly LIST_CACHE_PREFIX = "orders:list";
    private readonly LIST_CACHE_TTL = Number(process.env.ORDERS_LIST_CACHE_TTL_MS || 5000);
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

    private getAccessCacheScopeParts(access?: AccessContext): Array<string> {
        const scope = access?.scope ?? "all";
        if (scope === "own") {
            if (!access?.actorUserId) {
                return ["scope", "none"];
            }
            return ["scope", "own", "user", access.actorUserId];
        }
        return ["scope", scope];
    }

    private invalidateReadCaches(branchId?: string): void {
        const scope = this.getCacheScopeParts(branchId);
        const patterns = [
            cacheKey(this.LIST_CACHE_PREFIX, ...scope),
            cacheKey(this.SUMMARY_CACHE_PREFIX, ...scope),
            cacheKey(this.STATS_CACHE_PREFIX, ...scope),
            ...getDashboardCacheInvalidationPatterns(branchId),
        ];
        invalidateCache(patterns);
    }

    private invalidateTableCache(branchId?: string, tableId?: string): void {
        invalidateCache(getTableCacheInvalidationPatterns(branchId, tableId));
    }

    private async emitTableUpdate(tableId: string, branchId?: string, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(Tables) : getRepository(Tables);
        const table = await repo.findOneBy({ id: tableId });
        const effectiveBranchId = table?.branch_id || branchId;
        this.invalidateTableCache(effectiveBranchId, tableId);
        if (table && effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, table);
        }
    }

    private async ensureActiveShift(branchId?: string): Promise<void> {
        const activeShift = await this.shiftsService.getCurrentShift(branchId);
        if (!activeShift) {
            throw new AppError("กรุณาเปิดกะก่อนทำรายการ (Active Shift Required)", 400);
        }
    }

    private createServingGroup(): ServingGroupContext {
        return {
            id: randomUUID(),
            createdAt: new Date(),
        };
    }

    private createOrderNoCandidate(): string {
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
        const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `ORD-${datePart}-${timePart}-${rand}`;
    }

    private isUniqueOrderNoError(error: unknown): boolean {
        const code = (error as any)?.code || (error as any)?.driverError?.code;
        const constraint = String((error as any)?.constraint || (error as any)?.driverError?.constraint || "").toLowerCase();
        const message = String((error as any)?.message || "").toLowerCase();

        return code === "23505" && (
            constraint.includes("order_no") ||
            constraint.includes("sales_orders") ||
            message.includes("order_no") ||
            message.includes("sales_orders_order_no")
        );
    }

    private async saveOrderWithRetry(
        manager: EntityManager,
        orderData: Partial<SalesOrder>,
        generatedOrderNo: boolean
    ): Promise<SalesOrder> {
        const orderRepo = manager.getRepository(SalesOrder);
        const maxAttempts = generatedOrderNo ? 5 : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const candidateOrder = orderRepo.create({
                ...orderData,
                order_no: generatedOrderNo ? this.createOrderNoCandidate() : orderData.order_no,
            } as SalesOrder);

            try {
                return await orderRepo.save(candidateOrder);
            } catch (error) {
                if (!this.isUniqueOrderNoError(error)) {
                    throw error;
                }

                if (!generatedOrderNo) {
                    throw AppError.conflict("Order number already exists");
                }

                if (attempt === maxAttempts) {
                    throw AppError.internal("Unable to generate unique order number");
                }
            }
        }

        throw AppError.internal("Unable to persist order");
    }

    private async lockOrderForUpdate(manager: EntityManager, orderId: string, branchId?: string): Promise<SalesOrder> {
        const query = manager
            .getRepository(SalesOrder)
            .createQueryBuilder("order")
            .setLock("pessimistic_write")
            .where("order.id = :orderId", { orderId });

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        const order = await query.getOne();
        if (!order) {
            throw new AppError("Order not found", 404);
        }

        return order;
    }

    private async lockItemForUpdate(manager: EntityManager, itemId: string, branchId?: string): Promise<SalesOrderItem> {
        const itemRepo = manager.getRepository(SalesOrderItem);
        const lockQuery = itemRepo
            .createQueryBuilder("item")
            .setLock("pessimistic_write")
            .where("item.id = :itemId", { itemId });

        if (branchId) {
            lockQuery.andWhere(
                `EXISTS (
                    SELECT 1
                    FROM sales_orders so
                    WHERE so.id = item.order_id
                      AND so.branch_id = :branchId
                )`,
                { branchId },
            );
        }

        const lockedItem = await lockQuery.getOne();
        if (!lockedItem) {
            throw new AppError("Item not found", 404);
        }

        const query = itemRepo
            .createQueryBuilder("item")
            .leftJoinAndSelect("item.product", "product")
            .leftJoinAndSelect("item.details", "details")
            .innerJoinAndSelect("item.order", "salesOrder")
            .where("item.id = :itemId", { itemId });

        if (branchId) {
            query.andWhere("salesOrder.branch_id = :branchId", { branchId });
        }

        const item = await query.getOne();
        if (!item) {
            throw new AppError("Item not found", 404);
        }

        return item;
    }

    private async lockTablesForUpdate(
        manager: EntityManager,
        tableIds: Array<string | null | undefined>,
        branchId?: string
    ): Promise<Map<string, Tables>> {
        const uniqueTableIds = Array.from(new Set(tableIds.filter((tableId): tableId is string => Boolean(tableId))));
        if (uniqueTableIds.length === 0) {
            return new Map();
        }

        const query = manager
            .getRepository(Tables)
            .createQueryBuilder("table")
            .setLock("pessimistic_write")
            .where("table.id IN (:...tableIds)", { tableIds: uniqueTableIds });

        if (branchId) {
            query.andWhere("table.branch_id = :branchId", { branchId });
        }

        const tables = await query.getMany();
        const tableMap = new Map(tables.map((table) => [table.id, table]));

        for (const tableId of uniqueTableIds) {
            if (!tableMap.has(tableId)) {
                throw new AppError("Table not found for this branch", 404);
            }
        }

        return tableMap;
    }

    private ensureTableAvailable(table: Tables, allowOccupiedBySameTableId?: string | null): void {
        if (
            table.status === TableStatus.Unavailable &&
            (!allowOccupiedBySameTableId || table.id !== allowOccupiedBySameTableId)
        ) {
            throw AppError.conflict("Table is already occupied");
        }
    }

    private async validateRelatedEntities(
        manager: EntityManager,
        branchId: string | undefined,
        data: Partial<SalesOrder>
    ): Promise<void> {
        if (!branchId) {
            return;
        }

        if (data.delivery_id) {
            const delivery = await manager.getRepository(Delivery).findOneBy({ id: data.delivery_id, branch_id: branchId } as any);
            if (!delivery) throw new AppError("Delivery not found for this branch", 404);
        }

        if (data.discount_id) {
            const discount = await manager.getRepository(Discounts).findOneBy({ id: data.discount_id, branch_id: branchId } as any);
            if (!discount) throw new AppError("Discount not found for this branch", 404);
        }
    }

    private async refreshOrderAfterCommit(orderId: string, branchId?: string): Promise<SalesOrder | null> {
        return this.ordersModel.findOne(orderId, branchId);
    }

    private async finalizeOrderMutation(context: MutatedOrderContext, event: string): Promise<SalesOrder | null> {
        const order = await this.refreshOrderAfterCommit(context.orderId, context.branchId);
        const effectiveBranchId = order?.branch_id || context.branchId;

        this.invalidateReadCaches(effectiveBranchId);

        if (effectiveBranchId) {
            if (event === RealtimeEvents.orders.delete) {
                this.socketService.emitToBranch(effectiveBranchId, event, { id: context.orderId });
            } else if (order) {
                this.socketService.emitToBranch(effectiveBranchId, event, order);
            }
        }

        for (const tableId of context.tableIdsToRefresh ?? []) {
            await this.emitTableUpdate(tableId, effectiveBranchId);
        }

        return order;
    }

    private async prepareItems(
        items: any[],
        manager: EntityManager,
        branchId?: string,
        orderType?: OrderType,
        servingGroup?: ServingGroupContext
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
            item.serving_group_id = servingGroup?.id ?? randomUUID();
            item.serving_group_created_at = servingGroup?.createdAt ?? new Date();
            item.serving_status = ServingStatus.PendingServe;
            item.status = itemData.status
                ? this.ensureValidStatus(String(itemData.status))
                : OrderStatus.Pending;

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

    private canSyncFromItemStatuses(status: OrderStatus): boolean {
        return (
            status === OrderStatus.Pending ||
            status === OrderStatus.Cooking ||
            status === OrderStatus.Served
        );
    }

    private deriveOrderStatusFromItems(items: SalesOrderItem[]): OrderStatus | null {
        if (items.length === 0) return null;

        const activeItems = items.filter((item) => !isCancelledStatus(String(item.status)));
        if (activeItems.length === 0) return OrderStatus.Cancelled;

        // Current flow keeps all active items under "Pending/กำลังดำเนินการ".
        activeItems.forEach((item) => {
            this.ensureValidStatus(String(item.status));
        });
        return OrderStatus.Pending;
    }

    private async syncOrderStatusFromItems(orderId: string, branchId?: string, manager?: EntityManager): Promise<void> {
        const orderRepo = manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
        const itemRepo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);

        const order = await orderRepo.findOne({
            where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId },
        });
        if (!order) return;
        if (!this.canSyncFromItemStatuses(order.status)) return;

        const items = await itemRepo.find({ where: { order_id: orderId } });
        const nextStatus = this.deriveOrderStatusFromItems(items);
        if (!nextStatus || nextStatus === order.status) return;

        await orderRepo.update(order.id, { status: nextStatus } as Partial<SalesOrder>);
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
        const statusKey = statuses?.length ? statuses.join(",") : "all";
        const typeKey = type || "all";
        const scope = this.getCacheScopeParts(branchId);
        const accessScope = this.getAccessCacheScopeParts(access);
        const key = cacheKey(
            this.LIST_CACHE_PREFIX,
            ...scope,
            ...accessScope,
            "list",
            page,
            limit,
            statusKey,
            typeKey,
            sortCreated
        );

        if (query?.trim() || page > 1) {
            return this.ordersModel.findAll(page, limit, statuses, type, query, branchId, access, sortCreated);
        }

        return withCache(
            key,
            () => this.ordersModel.findAll(page, limit, statuses, type, query, branchId, access, sortCreated),
            this.LIST_CACHE_TTL,
            queryCache as any,
            {
                onHit: (source) => this.observeCache("orders.list.active", "hit", source),
                onMiss: () => this.observeCache("orders.list.active", "miss"),
            }
        );
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
        const accessScope = this.getAccessCacheScopeParts(access);
        const key = cacheKey(
            this.SUMMARY_CACHE_PREFIX,
            ...scope,
            ...accessScope,
            "list",
            page,
            limit,
            statusKey,
            typeKey,
            sortCreated
        );

        if (options?.bypassCache || query?.trim()) {
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

    async getStats(branchId?: string, access?: AccessContext, options?: { bypassCache?: boolean }): Promise<ChannelStats> {
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
        const accessScope = this.getAccessCacheScopeParts(access);
        const key = cacheKey(this.STATS_CACHE_PREFIX, ...scope, ...accessScope, "active");

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

    async findOne(id: string, branchId?: string, access?: AccessContext, manager?: EntityManager): Promise<SalesOrder | null> {
        try {
            return this.ordersModel.findOne(id, branchId, access, manager)
        } catch (error) {
            throw error
        }
    }

    async getServingBoard(branchId?: string): Promise<ServingBoardGroup[]> {
        if (!branchId) {
            return [];
        }

        const activeOrderStatuses = [
            OrderStatus.Pending,
            OrderStatus.pending,
            OrderStatus.Cooking,
            OrderStatus.Served,
        ];

        const excludedItemStatuses = [
            OrderStatus.Cancelled,
            OrderStatus.cancelled,
            OrderStatus.Paid,
        ];

        const rows = await getRepository(SalesOrderItem)
            .createQueryBuilder("item")
            .innerJoin("item.order", "order")
            .leftJoin("order.table", "table")
            .leftJoin("order.delivery", "delivery")
            .leftJoin("item.product", "product")
            .select("item.id", "item_id")
            .addSelect("item.order_id", "order_id")
            .addSelect("order.order_no", "order_no")
            .addSelect("order.order_type", "order_type")
            .addSelect("order.status", "order_status")
            .addSelect("order.delivery_code", "delivery_code")
            .addSelect("table.table_name", "table_name")
            .addSelect("delivery.delivery_name", "delivery_name")
            .addSelect("item.product_id", "product_id")
            .addSelect("COALESCE(product.display_name, '-')", "display_name")
            .addSelect("product.img_url", "product_image_url")
            .addSelect("item.quantity", "quantity")
            .addSelect("item.notes", "notes")
            .addSelect("item.serving_status", "serving_status")
            .addSelect("item.serving_group_id", "serving_group_id")
            .addSelect("item.serving_group_created_at", "serving_group_created_at")
            .addSelect(`(
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'detail_name', d.detail_name,
                        'extra_price', d.extra_price
                    )
                ), '[]')
                FROM sales_order_detail d
                WHERE d.orders_item_id = item.id
            )`, "details")
            .where("order.branch_id = :branchId", { branchId })
            .andWhere("order.status IN (:...activeOrderStatuses)", { activeOrderStatuses })
            .andWhere("item.status::text NOT IN (:...excludedItemStatuses)", { excludedItemStatuses })
            .orderBy("item.serving_group_created_at", "DESC")
            .addOrderBy("order.create_date", "DESC")
            .addOrderBy("item.id", "ASC")
            .getRawMany<ServingBoardRow>();

        return groupServingBoardRows(
            rows.map((row) => ({
                ...row,
                quantity: Number(row.quantity || 0),
            }))
        );
    }

    async updateServingItemStatus(itemId: string, servingStatus: ServingStatus, branchId?: string): Promise<void> {
        const item = await this.ordersModel.findItemById(itemId, undefined, branchId);
        if (!item) {
            throw new AppError("Item not found", 404);
        }
        if (
            isCancelledStatus(String(item.status)) ||
            !item.order ||
            ![OrderStatus.Pending, OrderStatus.pending, OrderStatus.Cooking, OrderStatus.Served].includes(item.order.status)
        ) {
            throw new AppError("Item is not available on serving board", 409);
        }

        await getRepository(SalesOrderItem).update(itemId, {
            serving_status: servingStatus,
        } as Partial<SalesOrderItem>);

        const effectiveBranchId = item.order?.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.servingBoard.update, {
                item_id: itemId,
                order_id: item.order_id,
                serving_group_id: item.serving_group_id,
                serving_status: servingStatus,
            });
        }
    }

    async updateServingGroupStatus(groupId: string, servingStatus: ServingStatus, branchId?: string): Promise<void> {
        const itemRepo = getRepository(SalesOrderItem);

        const items = await itemRepo
            .createQueryBuilder("item")
            .innerJoinAndSelect("item.order", "order")
            .where("item.serving_group_id = :groupId", { groupId })
            .andWhere(branchId ? "order.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
            .andWhere("order.status IN (:...activeOrderStatuses)", {
                activeOrderStatuses: [
                    OrderStatus.Pending,
                    OrderStatus.pending,
                    OrderStatus.Cooking,
                    OrderStatus.Served,
                ],
            })
            .andWhere("item.status::text NOT IN (:...excludedItemStatuses)", {
                excludedItemStatuses: [
                    OrderStatus.Cancelled,
                    OrderStatus.cancelled,
                    OrderStatus.Paid,
                ],
            })
            .getMany();

        if (items.length === 0) {
            throw new AppError("Serving group not found", 404);
        }

        await itemRepo.update(
            { id: In(items.map((item) => item.id)) },
            { serving_status: servingStatus } as Partial<SalesOrderItem>
        );

        const effectiveBranchId = items[0].order?.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.servingBoard.update, {
                serving_group_id: groupId,
                order_id: items[0].order_id,
                serving_status: servingStatus,
            });
        }
    }

    async create(orders: SalesOrder, branchId?: string): Promise<SalesOrder> {
        const normalizedStatus = orders.status
            ? this.ensureValidStatus(String(orders.status))
            : OrderStatus.Pending;
        const effectiveBranchId = orders.branch_id || branchId;
        await this.ensureActiveShift(effectiveBranchId);

        const createdOrder = await runInTransaction(async (manager) => {
            const orderData = {
                ...orders,
                branch_id: effectiveBranchId,
                status: normalizedStatus,
            } as Partial<SalesOrder>;

            await this.validateRelatedEntities(manager, effectiveBranchId, orderData);

            const lockedTables = await this.lockTablesForUpdate(manager, [orderData.table_id], effectiveBranchId);
            const lockedTable = orderData.table_id ? lockedTables.get(orderData.table_id) : undefined;
            if (lockedTable) {
                this.ensureTableAvailable(lockedTable);
            }

            const savedOrder = await this.saveOrderWithRetry(manager, orderData, !orderData.order_no);

            if (lockedTable) {
                lockedTable.status = TableStatus.Unavailable;
                await manager.getRepository(Tables).save(lockedTable);
            }

            return savedOrder;
        });

        const finalizedOrder = await this.finalizeOrderMutation(
            {
                orderId: createdOrder.id,
                branchId: createdOrder.branch_id || effectiveBranchId,
                tableIdsToRefresh: createdOrder.table_id ? [createdOrder.table_id] : [],
            },
            RealtimeEvents.orders.create
        );

        return finalizedOrder ?? createdOrder;
    }

    async createFullOrder(data: any, branchId?: string): Promise<SalesOrder> {
        const { items, ...orderData } = data;
        const effectiveBranchId = orderData.branch_id || branchId;
        await this.ensureActiveShift(effectiveBranchId);
        const createdOrder = await runInTransaction(async (manager) => {
            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new AppError("กรุณาระบุรายการสินค้า", 400);
            }

            const nextOrderData = {
                ...orderData,
                branch_id: effectiveBranchId,
                status: orderData.status
                    ? this.ensureValidStatus(String(orderData.status))
                    : OrderStatus.Pending,
            } as Partial<SalesOrder>;

            await this.validateRelatedEntities(manager, effectiveBranchId, nextOrderData);

            const lockedTables = await this.lockTablesForUpdate(manager, [nextOrderData.table_id], effectiveBranchId);
            const lockedTable = nextOrderData.table_id ? lockedTables.get(nextOrderData.table_id) : undefined;
            if (lockedTable) {
                this.ensureTableAvailable(lockedTable);
            }

            const servingGroup = this.createServingGroup();
            const preparedItems = await this.prepareItems(
                items,
                manager,
                effectiveBranchId,
                nextOrderData.order_type,
                servingGroup
            );

            const itemRepo = manager.getRepository(SalesOrderItem);
            const detailRepo = manager.getRepository(SalesOrderDetail);

            const savedOrder = await this.saveOrderWithRetry(manager, nextOrderData, !nextOrderData.order_no);

            if (lockedTable) {
                lockedTable.status = TableStatus.Unavailable;
                await manager.getRepository(Tables).save(lockedTable);
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
            await this.syncOrderStatusFromItems(savedOrder.id, effectiveBranchId, manager);
            return savedOrder;
        });

        const finalizedOrder = await this.finalizeOrderMutation(
            {
                orderId: createdOrder.id,
                branchId: createdOrder.branch_id || effectiveBranchId,
                tableIdsToRefresh: createdOrder.table_id ? [createdOrder.table_id] : [],
            },
            RealtimeEvents.orders.create
        );

        return finalizedOrder ?? createdOrder;
    }

    async update(id: string, orders: SalesOrder, branchId?: string): Promise<SalesOrder> {
        const mutationContext = await runInTransaction(async (manager) => {
            const lockedOrder = await this.lockOrderForUpdate(manager, id, branchId);
            const effectiveBranchId = lockedOrder.branch_id || branchId;
            const normalizedStatus = orders.status
                ? this.ensureValidStatus(String(orders.status))
                : undefined;

            await this.validateRelatedEntities(manager, effectiveBranchId, orders);

            const previousTableId = lockedOrder.table_id || null;
            const nextTableId = orders.table_id !== undefined
                ? (orders.table_id || null)
                : previousTableId;
            const lockedTables = await this.lockTablesForUpdate(manager, [previousTableId, nextTableId], effectiveBranchId);
            const nextTable = nextTableId ? lockedTables.get(nextTableId) : undefined;
            if (nextTable && nextTableId !== previousTableId) {
                this.ensureTableAvailable(nextTable);
            }

            try {
                Object.assign(lockedOrder, {
                    ...orders,
                    branch_id: effectiveBranchId,
                    status: normalizedStatus ?? lockedOrder.status,
                } as Partial<SalesOrder>);
                await manager.getRepository(SalesOrder).save(lockedOrder);
            } catch (error) {
                if (this.isUniqueOrderNoError(error)) {
                    throw AppError.conflict("Order number already exists");
                }
                throw error;
            }

            if (normalizedStatus === OrderStatus.Cancelled) {
                await this.ordersModel.updateAllItemsStatus(id, OrderStatus.Cancelled, manager);
            }

            await recalculateOrderTotal(id, manager);
            await this.syncOrderStatusFromItems(id, effectiveBranchId, manager);

            const refreshedOrder = await this.ordersModel.findOne(id, effectiveBranchId, undefined, manager);
            if (!refreshedOrder) {
                throw new AppError("Order not found", 404);
            }

            const finalStatus = this.ensureValidStatus(String(refreshedOrder.status));
            const finalTableId = refreshedOrder.table_id || null;
            const tablesToPersist: Tables[] = [];

            if (previousTableId && previousTableId !== finalTableId) {
                const previousTable = lockedTables.get(previousTableId);
                if (previousTable) {
                    previousTable.status = TableStatus.Available;
                    tablesToPersist.push(previousTable);
                }
            }

            if (finalTableId) {
                const activeTable = lockedTables.get(finalTableId);
                if (activeTable) {
                    activeTable.status =
                        finalStatus === OrderStatus.Completed || finalStatus === OrderStatus.Cancelled
                            ? TableStatus.Available
                            : TableStatus.Unavailable;
                    tablesToPersist.push(activeTable);
                }
            }

            if (tablesToPersist.length > 0) {
                const dedupedTables = Array.from(new Map(tablesToPersist.map((table) => [table.id, table])).values());
                await manager.getRepository(Tables).save(dedupedTables);
            }

            return {
                orderId: refreshedOrder.id,
                branchId: refreshedOrder.branch_id || effectiveBranchId,
                tableIdsToRefresh: Array.from(new Set([previousTableId, finalTableId].filter((tableId): tableId is string => Boolean(tableId)))),
            } satisfies MutatedOrderContext;
        });

        const finalizedOrder = await this.finalizeOrderMutation(mutationContext, RealtimeEvents.orders.update);
        if (!finalizedOrder) {
            throw new AppError("Order not found", 404);
        }

        return finalizedOrder;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const mutationContext = await runInTransaction(async (manager) => {
            const order = await this.lockOrderForUpdate(manager, id, branchId);
            const effectiveBranchId = order.branch_id || branchId;
            const lockedTables = await this.lockTablesForUpdate(manager, [order.table_id], effectiveBranchId);

            if (order.table_id) {
                const table = lockedTables.get(order.table_id);
                if (table) {
                    table.status = TableStatus.Available;
                    await manager.getRepository(Tables).save(table);
                }
            }

            await this.ordersModel.delete(id, manager, effectiveBranchId);
            return {
                orderId: id,
                branchId: effectiveBranchId,
                tableIdsToRefresh: order.table_id ? [order.table_id] : [],
            } satisfies MutatedOrderContext;
        });

        await this.finalizeOrderMutation(mutationContext, RealtimeEvents.orders.delete);
    }

    async updateItemStatus(itemId: string, status: string, branchId?: string): Promise<void> {
        const normalized = this.ensureValidStatus(status);
        const mutationContext = await runInTransaction(async (manager) => {
            const item = await this.lockItemForUpdate(manager, itemId, branchId);
            const effectiveBranchId = item.order?.branch_id || branchId;
            await this.lockOrderForUpdate(manager, item.order_id, effectiveBranchId);

            if (item.status !== normalized) {
                await this.ordersModel.updateItemStatus(itemId, normalized, manager);
            }

            await recalculateOrderTotal(item.order_id, manager);
            await this.syncOrderStatusFromItems(item.order_id, effectiveBranchId, manager);

            return {
                orderId: item.order_id,
                branchId: effectiveBranchId,
            } satisfies MutatedOrderContext;
        });

        await this.finalizeOrderMutation(mutationContext, RealtimeEvents.orders.update);
    }

    async addItems(orderId: string, items: any[], branchId?: string): Promise<SalesOrder> {
        return await runInTransaction(async (manager) => {
            try {
                if (!Array.isArray(items) || items.length === 0) {
                    throw new AppError("Missing items", 400);
                }

                const order = await this.lockOrderForUpdate(manager, orderId, branchId);

                const servingGroup = this.createServingGroup();
                const preparedItems = await this.prepareItems(
                    items,
                    manager,
                    order.branch_id || branchId,
                    order.order_type,
                    servingGroup
                );

                for (const prepared of preparedItems) {
                    prepared.item.order_id = orderId;
                    const savedItem = await this.ordersModel.createItem(prepared.item, manager);

                    if (prepared.details.length > 0) {
                        const detailRepo = manager.getRepository(SalesOrderDetail);
                        for (const detail of prepared.details) {
                            detail.orders_item_id = savedItem.id;
                            await detailRepo.save(detail);
                        }
                    }
                }

                await recalculateOrderTotal(orderId, manager);
                await this.syncOrderStatusFromItems(orderId, branchId, manager);

                const updatedOrder = await this.ordersModel.findOne(orderId, branchId, undefined, manager);
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

    async addItem(orderId: string, itemData: any, branchId?: string): Promise<SalesOrder> {
        return this.addItems(orderId, [itemData], branchId);
    }

    async updateItemDetails(itemId: string, data: { quantity?: number, notes?: string, details?: any[] }, branchId?: string): Promise<SalesOrder> {
        return await runInTransaction(async (manager) => {
            try {
                const item = await this.lockItemForUpdate(manager, itemId, branchId);
                await this.lockOrderForUpdate(manager, item.order_id, item.order?.branch_id || branchId);

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
                await this.syncOrderStatusFromItems(updatedItemWithDetails.order_id, branchId, manager);

                const updatedOrder = await this.ordersModel.findOne(
                    updatedItemWithDetails.order_id,
                    branchId,
                    undefined,
                    manager
                );
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
                const item = await this.lockItemForUpdate(manager, itemId, branchId);
                await this.lockOrderForUpdate(manager, item.order_id, item.order?.branch_id || branchId);
                const orderId = item.order_id;

                // Soft-cancel instead of hard delete to keep auditability and order history.
                if (!isCancelledStatus(item.status)) {
                    await this.ordersModel.updateItemStatus(itemId, OrderStatus.Cancelled, manager);
                }

                await recalculateOrderTotal(orderId, manager);
                await this.syncOrderStatusFromItems(orderId, branchId, manager);

                const updatedOrder = await this.ordersModel.findOne(orderId, branchId, undefined, manager);
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
