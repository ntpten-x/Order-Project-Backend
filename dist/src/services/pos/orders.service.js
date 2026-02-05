"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const socket_service_1 = require("../socket.service");
const cache_1 = require("../../utils/cache");
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const Tables_1 = require("../../entity/pos/Tables");
const Delivery_1 = require("../../entity/pos/Delivery");
const Discounts_1 = require("../../entity/pos/Discounts");
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const SalesOrderDetail_1 = require("../../entity/pos/SalesOrderDetail");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const Products_1 = require("../../entity/pos/Products");
const typeorm_1 = require("typeorm");
const orderTotals_service_1 = require("./orderTotals.service");
const AppError_1 = require("../../utils/AppError");
const shifts_service_1 = require("./shifts.service");
const orderQueue_service_1 = require("./orderQueue.service");
const OrderQueue_1 = require("../../entity/pos/OrderQueue");
const dbContext_1 = require("../../database/dbContext");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
class OrdersService {
    constructor(ordersModel) {
        this.ordersModel = ordersModel;
        this.socketService = socket_service_1.SocketService.getInstance();
        this.shiftsService = new shifts_service_1.ShiftsService();
        this.queueService = new orderQueue_service_1.OrderQueueService();
        this.SUMMARY_CACHE_PREFIX = "orders:summary";
        this.SUMMARY_CACHE_TTL = 3 * 1000; // 3 seconds
        this.STATS_CACHE_PREFIX = "orders:stats";
        this.STATS_CACHE_TTL = 3 * 1000; // 3 seconds
    }
    getCacheScopeParts(branchId) {
        const ctx = (0, dbContext_1.getDbContext)();
        const effectiveBranchId = branchId !== null && branchId !== void 0 ? branchId : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
        if (effectiveBranchId)
            return ["branch", effectiveBranchId];
        if (ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin)
            return ["admin"];
        return ["public"];
    }
    ensureActiveShift(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeShift = yield this.shiftsService.getCurrentShift(userId);
            if (!activeShift) {
                throw new AppError_1.AppError("กรุณาเปิดกะก่อนทำรายการ (Active Shift Required)", 400);
            }
        });
    }
    ensureOrderNo(orderNo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (orderNo)
                return orderNo;
            for (let i = 0; i < 5; i++) {
                const now = new Date();
                const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
                const timePart = now.toTimeString().slice(0, 8).replace(/:/g, "");
                const rand = Math.floor(1000 + Math.random() * 9000);
                const candidate = `ORD-${datePart}-${timePart}-${rand}`;
                const existing = yield this.ordersModel.findOneByOrderNo(candidate);
                if (!existing)
                    return candidate;
            }
            throw new AppError_1.AppError("Unable to generate order number", 500);
        });
    }
    prepareItems(items, manager, branchId, orderType) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const productRepo = manager.getRepository(Products_1.Products);
            // 1. Collect all product IDs
            const productIds = items
                .map(i => i.product_id)
                .filter((id) => !!id);
            if (productIds.length === 0) {
                throw new AppError_1.AppError("ไม่มีรายการสินค้าในคำสั่งซื้อ", 400);
            }
            // 2. Optimization: Batch Fetch Products (Single Query)
            // Instead of querying N times inside the loop
            const where = {
                id: (0, typeorm_1.In)(productIds),
                is_active: true
            };
            if (branchId) {
                where.branch_id = branchId;
            }
            const products = yield productRepo.findBy(where);
            // 3. Create Map for O(1) Lookup
            const productMap = new Map(products.map(p => [p.id, p]));
            const prepared = [];
            for (const itemData of items) {
                if (!(itemData === null || itemData === void 0 ? void 0 : itemData.product_id)) {
                    throw new AppError_1.AppError("Missing product_id", 400);
                }
                // Lookup from memory instead of DB
                const product = productMap.get(itemData.product_id);
                if (!product) {
                    throw new AppError_1.AppError(`Product not found or inactive`, 404);
                }
                const quantity = Number(itemData.quantity);
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    throw new AppError_1.AppError("Invalid quantity", 400);
                }
                const discount = Number(itemData.discount_amount || 0);
                if (discount < 0) {
                    throw new AppError_1.AppError("Invalid discount amount", 400);
                }
                const detailsData = Array.isArray(itemData.details) ? itemData.details : [];
                const detailsTotal = detailsData.reduce((sum, d) => sum + (Number(d === null || d === void 0 ? void 0 : d.extra_price) || 0), 0);
                const unitPrice = orderType === OrderEnums_1.OrderType.Delivery
                    ? Number((_a = product.price_delivery) !== null && _a !== void 0 ? _a : product.price)
                    : Number(product.price);
                const lineTotal = (unitPrice + detailsTotal) * quantity - discount;
                const item = new SalesOrderItem_1.SalesOrderItem();
                item.product_id = product.id;
                item.quantity = quantity;
                item.price = unitPrice;
                item.discount_amount = discount;
                item.total_price = Math.max(0, Number(lineTotal));
                item.notes = itemData.notes;
                item.status = itemData.status || OrderEnums_1.OrderStatus.Pending;
                const details = detailsData.map((d) => {
                    var _a;
                    const detail = new SalesOrderDetail_1.SalesOrderDetail();
                    detail.detail_name = (_a = d === null || d === void 0 ? void 0 : d.detail_name) !== null && _a !== void 0 ? _a : "";
                    detail.extra_price = Number((d === null || d === void 0 ? void 0 : d.extra_price) || 0);
                    return detail;
                });
                prepared.push({ item, details });
            }
            return prepared;
        });
    }
    ensureValidStatus(status) {
        if (!Object.values(OrderEnums_1.OrderStatus).includes(status)) {
            throw new AppError_1.AppError("Invalid status", 400);
        }
        return status;
    }
    findAll(page, limit, statuses, type, query, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findAll(page, limit, statuses, type, query, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findAllSummary(page, limit, statuses, type, query, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const statusKey = (statuses === null || statuses === void 0 ? void 0 : statuses.length) ? statuses.join(",") : "all";
            const typeKey = type || "all";
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.SUMMARY_CACHE_PREFIX, ...scope, "list", page, limit, statusKey, typeKey);
            if ((query === null || query === void 0 ? void 0 : query.trim()) || page > 1) {
                return this.ordersModel.findAllSummary(page, limit, statuses, type, query, branchId);
            }
            return (0, cache_1.withCache)(key, () => this.ordersModel.findAllSummary(page, limit, statuses, type, query, branchId), this.SUMMARY_CACHE_TTL, cache_1.queryCache);
        });
    }
    getStats(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeStatuses = [
                OrderEnums_1.OrderStatus.Pending,
                OrderEnums_1.OrderStatus.Cooking,
                OrderEnums_1.OrderStatus.Served,
                OrderEnums_1.OrderStatus.WaitingForPayment,
            ];
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.STATS_CACHE_PREFIX, ...scope, "active");
            return (0, cache_1.withCache)(key, () => this.ordersModel.getStats(activeStatuses, branchId), this.STATS_CACHE_TTL, cache_1.queryCache);
        });
    }
    findAllItems(status_1) {
        return __awaiter(this, arguments, void 0, function* (status, page = 1, limit = 100, branchId) {
            return this.ordersModel.findAllItems(status, page, limit, branchId);
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(orders, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (orders.created_by_id) {
                yield this.ensureActiveShift(orders.created_by_id);
            }
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (orders.order_no) {
                        const existingOrder = yield this.ordersModel.findOneByOrderNo(orders.order_no);
                        if (existingOrder) {
                            throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                        }
                    }
                    else {
                        orders.order_no = yield this.ensureOrderNo();
                    }
                    const effectiveBranchId = orders.branch_id || branchId;
                    // Validate foreign keys to prevent cross-branch access
                    if (effectiveBranchId) {
                        if (orders.table_id) {
                            const table = yield manager.getRepository(Tables_1.Tables).findOneBy({ id: orders.table_id, branch_id: effectiveBranchId });
                            if (!table)
                                throw new AppError_1.AppError("Table not found for this branch", 404);
                        }
                        if (orders.delivery_id) {
                            const delivery = yield manager.getRepository(Delivery_1.Delivery).findOneBy({ id: orders.delivery_id, branch_id: effectiveBranchId });
                            if (!delivery)
                                throw new AppError_1.AppError("Delivery not found for this branch", 404);
                        }
                        if (orders.discount_id) {
                            const discount = yield manager.getRepository(Discounts_1.Discounts).findOneBy({ id: orders.discount_id, branch_id: effectiveBranchId });
                            if (!discount)
                                throw new AppError_1.AppError("Discount not found for this branch", 404);
                        }
                    }
                    // Pass manager to create which uses it for repository
                    const createdOrder = yield this.ordersModel.create(orders, manager);
                    // Update Table Status if DineIn
                    if (createdOrder.table_id) {
                        const tablesRepo = manager.getRepository(Tables_1.Tables);
                        yield tablesRepo.update(createdOrder.table_id, { status: Tables_1.TableStatus.Unavailable });
                    }
                    return createdOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((createdOrder) => __awaiter(this, void 0, void 0, function* () {
                // Post-transaction Side Effects
                const effectiveBranchId = createdOrder.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.create, createdOrder);
                }
                if (createdOrder.table_id) {
                    const tablesRepo = (0, dbContext_1.getRepository)(Tables_1.Tables);
                    tablesRepo.findOneBy({ id: createdOrder.table_id }).then(t => {
                        if (!t)
                            return;
                        if (effectiveBranchId) {
                            this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.tables.update, t);
                        }
                    });
                }
                // Auto-add to queue if order is pending
                if (createdOrder.status === OrderEnums_1.OrderStatus.Pending) {
                    try {
                        yield this.queueService.addToQueue(createdOrder.id, OrderQueue_1.QueuePriority.Normal, createdOrder.branch_id);
                    }
                    catch (error) {
                        // Log but don't fail if queue add fails (might already be in queue)
                        console.warn('Failed to add order to queue:', error);
                    }
                }
                return createdOrder;
            }));
        });
    }
    createFullOrder(data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { items } = data, orderData = __rest(data, ["items"]);
            if (orderData.created_by_id) {
                yield this.ensureActiveShift(orderData.created_by_id);
            }
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                if (!items || !Array.isArray(items) || items.length === 0) {
                    throw new AppError_1.AppError("กรุณาระบุรายการสินค้า", 400);
                }
                if (orderData.order_no) {
                    const existingOrder = yield this.ordersModel.findOneByOrderNo(orderData.order_no);
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                    }
                }
                else {
                    orderData.order_no = yield this.ensureOrderNo();
                }
                if (!orderData.status) {
                    orderData.status = OrderEnums_1.OrderStatus.Pending;
                }
                const effectiveBranchId = orderData.branch_id || branchId;
                // Validate foreign keys to prevent cross-branch access
                if (effectiveBranchId) {
                    if (orderData.table_id) {
                        const table = yield manager.getRepository(Tables_1.Tables).findOneBy({ id: orderData.table_id, branch_id: effectiveBranchId });
                        if (!table)
                            throw new AppError_1.AppError("Table not found for this branch", 404);
                    }
                    if (orderData.delivery_id) {
                        const delivery = yield manager.getRepository(Delivery_1.Delivery).findOneBy({ id: orderData.delivery_id, branch_id: effectiveBranchId });
                        if (!delivery)
                            throw new AppError_1.AppError("Delivery not found for this branch", 404);
                    }
                    if (orderData.discount_id) {
                        const discount = yield manager.getRepository(Discounts_1.Discounts).findOneBy({ id: orderData.discount_id, branch_id: effectiveBranchId });
                        if (!discount)
                            throw new AppError_1.AppError("Discount not found for this branch", 404);
                    }
                }
                const preparedItems = yield this.prepareItems(items, manager, branchId, orderData.order_type);
                const orderRepo = manager.getRepository(SalesOrder_1.SalesOrder);
                const itemRepo = manager.getRepository(SalesOrderItem_1.SalesOrderItem);
                const detailRepo = manager.getRepository(SalesOrderDetail_1.SalesOrderDetail);
                const savedOrder = yield orderRepo.save(orderData);
                if (savedOrder.table_id) {
                    const tablesRepo = manager.getRepository(Tables_1.Tables);
                    yield tablesRepo.update(savedOrder.table_id, { status: Tables_1.TableStatus.Unavailable });
                }
                for (const prepared of preparedItems) {
                    prepared.item.order_id = savedOrder.id;
                    const savedItem = yield itemRepo.save(prepared.item);
                    if (prepared.details.length > 0) {
                        for (const detail of prepared.details) {
                            detail.orders_item_id = savedItem.id;
                            yield detailRepo.save(detail);
                        }
                    }
                }
                yield (0, orderTotals_service_1.recalculateOrderTotal)(savedOrder.id, manager);
                return savedOrder;
            })).then((savedOrder) => __awaiter(this, void 0, void 0, function* () {
                const fullOrder = yield this.ordersModel.findOne(savedOrder.id, branchId);
                if (fullOrder) {
                    const effectiveBranchId = fullOrder.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.create, fullOrder);
                    }
                    if (fullOrder.table_id) {
                        const tablesRepo = (0, dbContext_1.getRepository)(Tables_1.Tables);
                        const t = yield tablesRepo.findOneBy({ id: fullOrder.table_id });
                        if (t) {
                            if (effectiveBranchId) {
                                this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.tables.update, t);
                            }
                        }
                    }
                    // Auto-add to queue if order is pending
                    if (fullOrder.status === OrderEnums_1.OrderStatus.Pending) {
                        try {
                            yield this.queueService.addToQueue(fullOrder.id, OrderQueue_1.QueuePriority.Normal, fullOrder.branch_id);
                        }
                        catch (error) {
                            // Log but don't fail if queue add fails (might already be in queue)
                            console.warn('Failed to add order to queue:', error);
                        }
                    }
                    return fullOrder;
                }
                return savedOrder;
            }));
        });
    }
    update(id, orders, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const orderToUpdate = yield this.ordersModel.findOne(id, branchId);
                if (!orderToUpdate) {
                    throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการแก้ไข");
                }
                const effectiveBranchId = orderToUpdate.branch_id || branchId;
                // Validate foreign keys to prevent cross-branch access
                if (effectiveBranchId) {
                    if (orders.table_id !== undefined && orders.table_id !== null) {
                        const table = yield (0, dbContext_1.getRepository)(Tables_1.Tables).findOneBy({ id: orders.table_id, branch_id: effectiveBranchId });
                        if (!table)
                            throw new AppError_1.AppError("Table not found for this branch", 404);
                    }
                    if (orders.delivery_id !== undefined && orders.delivery_id !== null) {
                        const delivery = yield (0, dbContext_1.getRepository)(Delivery_1.Delivery).findOneBy({ id: orders.delivery_id, branch_id: effectiveBranchId });
                        if (!delivery)
                            throw new AppError_1.AppError("Delivery not found for this branch", 404);
                    }
                    if (orders.discount_id !== undefined && orders.discount_id !== null) {
                        const discount = yield (0, dbContext_1.getRepository)(Discounts_1.Discounts).findOneBy({ id: orders.discount_id, branch_id: effectiveBranchId });
                        if (!discount)
                            throw new AppError_1.AppError("Discount not found for this branch", 404);
                    }
                }
                if (orders.order_no && orders.order_no !== orderToUpdate.order_no) {
                    const existingOrder = yield this.ordersModel.findOneByOrderNo(orders.order_no, effectiveBranchId);
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                    }
                }
                if (orders.status) {
                    this.ensureValidStatus(String(orders.status));
                }
                const updatedOrder = yield this.ordersModel.update(id, orders, undefined, branchId);
                if (orders.status) {
                    const normalizedStatus = this.ensureValidStatus(String(orders.status));
                    if (normalizedStatus === OrderEnums_1.OrderStatus.Cancelled) {
                        yield this.ordersModel.updateAllItemsStatus(id, OrderEnums_1.OrderStatus.Cancelled);
                    }
                }
                yield (0, orderTotals_service_1.recalculateOrderTotal)(id);
                const refreshedOrder = yield this.ordersModel.findOne(id, branchId);
                const result = refreshedOrder !== null && refreshedOrder !== void 0 ? refreshedOrder : updatedOrder;
                const finalStatus = (_a = orders.status) !== null && _a !== void 0 ? _a : result.status;
                // Release table if Order is Completed or Cancelled
                if ((finalStatus === OrderEnums_1.OrderStatus.Completed || finalStatus === OrderEnums_1.OrderStatus.Cancelled) && result.table_id) {
                    const tablesRepo = (0, dbContext_1.getRepository)(Tables_1.Tables);
                    yield tablesRepo.update(result.table_id, { status: Tables_1.TableStatus.Available });
                    const t = yield tablesRepo.findOneBy({ id: result.table_id });
                    if (t) {
                        const effectiveBranchId = result.branch_id || branchId;
                        if (effectiveBranchId) {
                            this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.tables.update, t);
                        }
                    }
                }
                // Update queue status based on order status
                try {
                    const queueRepo = (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue);
                    const queueItem = yield queueRepo.findOne({ where: { order_id: result.id } });
                    if (queueItem) {
                        if (finalStatus === OrderEnums_1.OrderStatus.Cooking) {
                            yield this.queueService.updateStatus(queueItem.id, OrderQueue_1.QueueStatus.Processing, branchId);
                        }
                        else if (finalStatus === OrderEnums_1.OrderStatus.Completed || finalStatus === OrderEnums_1.OrderStatus.Cancelled) {
                            yield this.queueService.updateStatus(queueItem.id, finalStatus === OrderEnums_1.OrderStatus.Completed
                                ? OrderQueue_1.QueueStatus.Completed
                                : OrderQueue_1.QueueStatus.Cancelled, branchId);
                        }
                    }
                }
                catch (error) {
                    // Log but don't fail if queue update fails
                    console.warn('Failed to update queue status:', error);
                }
                const emitBranchId = result.branch_id || branchId;
                if (emitBranchId) {
                    this.socketService.emitToBranch(emitBranchId, realtimeEvents_1.RealtimeEvents.orders.update, result);
                }
                return result;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const order = yield this.ordersModel.findOne(id, branchId);
                if (!order) {
                    throw new AppError_1.AppError("Order not found", 404);
                }
                if (order === null || order === void 0 ? void 0 : order.table_id) {
                    const tablesRepo = (0, dbContext_1.getRepository)(Tables_1.Tables);
                    yield tablesRepo.update(order.table_id, { status: Tables_1.TableStatus.Available });
                    const t = yield tablesRepo.findOneBy({ id: order.table_id });
                    if (t) {
                        const effectiveBranchId = order.branch_id || branchId;
                        if (effectiveBranchId) {
                            this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.tables.update, t);
                        }
                    }
                }
                yield this.ordersModel.delete(id, undefined, branchId);
                const effectiveBranchId = (order === null || order === void 0 ? void 0 : order.branch_id) || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.delete, { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateItemStatus(itemId, status, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const normalized = this.ensureValidStatus(status);
                const item = yield this.ordersModel.findItemById(itemId, undefined, branchId);
                if (!item)
                    throw new AppError_1.AppError("Item not found", 404);
                yield this.ordersModel.updateItemStatus(itemId, normalized);
                yield (0, orderTotals_service_1.recalculateOrderTotal)(item.order_id);
                const updatedOrder = yield this.ordersModel.findOne(item.order_id, branchId);
                if (!updatedOrder)
                    return;
                const effectiveBranchId = updatedOrder.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.update, updatedOrder);
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
    addItem(orderId, itemData, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const orderRepo = manager.getRepository(SalesOrder_1.SalesOrder);
                    const order = yield orderRepo.findOneBy(branchId ? { id: orderId, branch_id: branchId } : { id: orderId });
                    if (!order)
                        throw new AppError_1.AppError("Order not found", 404);
                    const prepared = yield this.prepareItems([itemData], manager, branchId, order.order_type);
                    const { item, details } = prepared[0];
                    item.order_id = orderId;
                    const savedItem = yield this.ordersModel.createItem(item, manager);
                    if (details.length > 0) {
                        const detailRepo = manager.getRepository(SalesOrderDetail_1.SalesOrderDetail);
                        for (const detail of details) {
                            detail.orders_item_id = savedItem.id;
                            yield detailRepo.save(detail);
                        }
                    }
                    yield (0, orderTotals_service_1.recalculateOrderTotal)(orderId, manager);
                    const updatedOrder = yield this.ordersModel.findOne(orderId, branchId);
                    return updatedOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((updatedOrder) => {
                if (updatedOrder) {
                    const effectiveBranchId = updatedOrder.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.update, updatedOrder);
                    }
                }
                return updatedOrder;
            });
        });
    }
    updateItemDetails(itemId, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const item = yield this.ordersModel.findItemById(itemId, manager, branchId);
                    if (!item)
                        throw new Error("Item not found");
                    const detailRepo = manager.getRepository(SalesOrderDetail_1.SalesOrderDetail);
                    if (data.details !== undefined) {
                        // 1. Delete existing details
                        yield detailRepo.delete({ orders_item_id: itemId });
                        // 2. Add new details
                        if (Array.isArray(data.details) && data.details.length > 0) {
                            for (const d of data.details) {
                                if (!d.detail_name && !d.extra_price)
                                    continue;
                                const detail = new SalesOrderDetail_1.SalesOrderDetail();
                                detail.orders_item_id = itemId;
                                detail.detail_name = d.detail_name || "";
                                detail.extra_price = Number(d.extra_price || 0);
                                yield detailRepo.save(detail);
                            }
                        }
                    }
                    // Refetch item with new details to get total price right
                    const updatedItemWithDetails = yield this.ordersModel.findItemById(itemId, manager, branchId);
                    if (!updatedItemWithDetails)
                        throw new Error("Item not found after detail update");
                    if (data.quantity !== undefined) {
                        const qty = Number(data.quantity);
                        if (!Number.isFinite(qty) || qty <= 0) {
                            throw new AppError_1.AppError("Invalid quantity", 400);
                        }
                        updatedItemWithDetails.quantity = qty;
                    }
                    if (data.notes !== undefined) {
                        updatedItemWithDetails.notes = data.notes;
                    }
                    const detailsTotal = updatedItemWithDetails.details ? updatedItemWithDetails.details.reduce((sum, d) => sum + (Number(d.extra_price) || 0), 0) : 0;
                    updatedItemWithDetails.total_price = Math.max(0, (Number(updatedItemWithDetails.price) + detailsTotal) * updatedItemWithDetails.quantity - Number(updatedItemWithDetails.discount_amount || 0));
                    yield this.ordersModel.updateItem(itemId, {
                        quantity: updatedItemWithDetails.quantity,
                        total_price: updatedItemWithDetails.total_price,
                        notes: updatedItemWithDetails.notes
                    }, manager);
                    yield (0, orderTotals_service_1.recalculateOrderTotal)(updatedItemWithDetails.order_id, manager);
                    const updatedOrder = yield this.ordersModel.findOne(updatedItemWithDetails.order_id, branchId);
                    return updatedOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((updatedOrder) => {
                if (updatedOrder) {
                    const effectiveBranchId = updatedOrder.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.update, updatedOrder);
                    }
                }
                return updatedOrder;
            });
        });
    }
    deleteItem(itemId, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const item = yield this.ordersModel.findItemById(itemId, manager, branchId);
                    if (!item)
                        throw new Error("Item not found");
                    const orderId = item.order_id;
                    yield this.ordersModel.deleteItem(itemId, manager);
                    yield (0, orderTotals_service_1.recalculateOrderTotal)(orderId, manager);
                    const updatedOrder = yield this.ordersModel.findOne(orderId, branchId);
                    return updatedOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((updatedOrder) => {
                if (updatedOrder) {
                    const effectiveBranchId = updatedOrder.branch_id || branchId;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, realtimeEvents_1.RealtimeEvents.orders.update, updatedOrder);
                    }
                }
                return updatedOrder;
            });
        });
    }
}
exports.OrdersService = OrdersService;
