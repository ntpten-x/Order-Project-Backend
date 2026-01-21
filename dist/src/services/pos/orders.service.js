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
const Orders_1 = require("../../entity/pos/Orders");
const database_1 = require("../../database/database");
const Tables_1 = require("../../entity/pos/Tables");
const OrdersItem_1 = require("../../entity/pos/OrdersItem");
const OrdersDetail_1 = require("../../entity/pos/OrdersDetail");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const priceCalculator_service_1 = require("./priceCalculator.service");
class OrdersService {
    constructor(ordersModel) {
        this.ordersModel = ordersModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(page, limit, statuses) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findAll(page, limit, statuses);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findAllItems(status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findAllItems(status);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(orders) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!orders.order_no) {
                        throw new Error("กรุณาระบุเลขที่ออเดอร์");
                    }
                    const existingOrder = yield this.ordersModel.findOneByOrderNo(orders.order_no);
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                    }
                    // Pass manager to create which uses it for repository
                    const createdOrder = yield this.ordersModel.create(orders, manager);
                    // Emitting socket inside transaction is risky if tx fails later, but here it's fine as we are near end.
                    // Ideally, emit AFTER tx commit.
                    // But for now, let's keep logic similar but in tx.
                    // Update Table Status if DineIn
                    if (createdOrder.table_id) {
                        const tablesRepo = manager.getRepository(Tables_1.Tables);
                        yield tablesRepo.update(createdOrder.table_id, { status: Tables_1.TableStatus.Unavailable });
                        const updatedTable = yield tablesRepo.findOneBy({ id: createdOrder.table_id });
                        /*
                           Note: Socket emission is side-effect. If tx causes rollback, UI might have received update.
                           Correct way is to return data and emit in controller, or use 'afterTransaction' hook.
                           For this refactor, I will emit AFTER the transaction block returns.
                        */
                    }
                    return createdOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((createdOrder) => {
                // Post-transaction Side Effects
                this.socketService.emit('orders:create', createdOrder);
                if (createdOrder.table_id) {
                    // We need to fetch table to emit? Or just trust it updated.
                    // Let's just re-fetch light or emit structure.
                    // Actually, reading from DB here is safe as tx committed.
                    const tablesRepo = database_1.AppDataSource.getRepository(Tables_1.Tables);
                    tablesRepo.findOneBy({ id: createdOrder.table_id }).then(t => {
                        if (t)
                            this.socketService.emit('tables:update', t);
                    });
                }
                return createdOrder;
            });
        });
    }
    createFullOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!data.order_no) {
                    throw new Error("กรุณาระบุเลขที่ออเดอร์");
                }
                const existingOrder = yield this.ordersModel.findOneByOrderNo(data.order_no);
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                }
                // Separate items from order data
                const { items } = data, orderData = __rest(data, ["items"]);
                const createdOrder = yield this.ordersModel.createFullOrder(orderData, items);
                // Fetch full data to emit
                const fullOrder = yield this.ordersModel.findOne(createdOrder.id);
                if (fullOrder) {
                    this.socketService.emit('orders:create', fullOrder);
                    return fullOrder;
                }
                return createdOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, orders) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orderToUpdate = yield this.ordersModel.findOne(id);
                if (!orderToUpdate) {
                    throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการแก้ไข");
                }
                if (orders.order_no && orders.order_no !== orderToUpdate.order_no) {
                    const existingOrder = yield this.ordersModel.findOneByOrderNo(orders.order_no);
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                    }
                }
                const updatedOrder = yield this.ordersModel.update(id, orders);
                this.socketService.emit('orders:update', updatedOrder);
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersModel.delete(id);
                this.socketService.emit('orders:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateItemStatus(itemId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersModel.updateItemStatus(itemId, status);
            }
            catch (error) {
                throw error;
            }
        });
    }
    addItem(orderId, itemData) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const item = new OrdersItem_1.OrdersItem();
                    item.order_id = orderId;
                    item.product_id = itemData.product_id;
                    item.quantity = itemData.quantity;
                    item.price = itemData.price;
                    item.discount_amount = itemData.discount_amount || 0;
                    const detailsTotal = itemData.details ? itemData.details.reduce((sum, d) => sum + (Number(d.extra_price) || 0), 0) : 0;
                    item.total_price = (Number(item.price) + detailsTotal) * item.quantity - Number(item.discount_amount || 0);
                    item.notes = itemData.notes;
                    item.status = OrderEnums_1.OrderStatus.Pending;
                    const savedItem = yield this.ordersModel.createItem(item, manager);
                    if (itemData.details && itemData.details.length > 0) {
                        const detailRepo = manager.getRepository(OrdersDetail_1.OrdersDetail);
                        for (const d of itemData.details) {
                            const detail = new OrdersDetail_1.OrdersDetail();
                            detail.orders_item_id = savedItem.id;
                            detail.detail_name = d.detail_name;
                            detail.extra_price = d.extra_price || 0;
                            yield detailRepo.save(detail);
                        }
                    }
                    yield this.recalculateOrderTotal(orderId, manager);
                    const updatedOrder = yield this.ordersModel.findOne(orderId);
                    return updatedOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((updatedOrder) => {
                if (updatedOrder)
                    this.socketService.emit('orders:update', updatedOrder);
                return updatedOrder;
            });
        });
    }
    updateItemDetails(itemId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const item = yield this.ordersModel.findItemById(itemId, manager);
                    if (!item)
                        throw new Error("Item not found");
                    if (data.quantity !== undefined) {
                        item.quantity = data.quantity;
                        item.total_price = (Number(item.price) * item.quantity) - Number(item.discount_amount || 0);
                    }
                    if (data.notes !== undefined) {
                        item.notes = data.notes;
                    }
                    yield this.ordersModel.updateItem(itemId, {
                        quantity: item.quantity,
                        total_price: item.total_price,
                        notes: item.notes
                    }, manager);
                    yield this.recalculateOrderTotal(item.order_id, manager);
                    const updatedOrder = yield this.ordersModel.findOne(item.order_id);
                    return updatedOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((updatedOrder) => {
                if (updatedOrder)
                    this.socketService.emit('orders:update', updatedOrder);
                return updatedOrder;
            });
        });
    }
    deleteItem(itemId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.transaction((manager) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const item = yield this.ordersModel.findItemById(itemId, manager);
                    if (!item)
                        throw new Error("Item not found");
                    const orderId = item.order_id;
                    yield this.ordersModel.deleteItem(itemId, manager);
                    yield this.recalculateOrderTotal(orderId, manager);
                    const updatedOrder = yield this.ordersModel.findOne(orderId);
                    return updatedOrder;
                }
                catch (error) {
                    throw error;
                }
            })).then((updatedOrder) => {
                if (updatedOrder)
                    this.socketService.emit('orders:update', updatedOrder);
                return updatedOrder;
            });
        });
    }
    recalculateOrderTotal(orderId, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(Orders_1.Orders) : database_1.AppDataSource.getRepository(Orders_1.Orders);
            // Fetch order with discount relation
            const order = yield repo.findOne({
                where: { id: orderId },
                relations: ["discount"]
            });
            if (!order)
                return;
            const items = yield this.ordersModel.findItemsByOrderId(orderId, manager);
            // Exclude cancelled items from total
            const validItems = items.filter(i => i.status !== OrderEnums_1.OrderStatus.Cancelled);
            // Calculate using Service
            const result = priceCalculator_service_1.PriceCalculatorService.calculateOrderTotal(validItems, order.discount);
            // Update Order
            yield this.ordersModel.update(orderId, {
                sub_total: result.subTotal,
                discount_amount: result.discountAmount,
                vat: result.vatAmount,
                total_amount: result.totalAmount
            }, manager);
        });
    }
}
exports.OrdersService = OrdersService;
