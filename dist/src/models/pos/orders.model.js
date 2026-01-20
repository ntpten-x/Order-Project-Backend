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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersModels = void 0;
const database_1 = require("../../database/database");
const Orders_1 = require("../../entity/pos/Orders");
const OrdersItem_1 = require("../../entity/pos/OrdersItem");
const OrdersDetail_1 = require("../../entity/pos/OrdersDetail");
const typeorm_1 = require("typeorm");
class OrdersModels {
    constructor() {
        this.ordersRepository = database_1.AppDataSource.getRepository(Orders_1.Orders);
    }
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, statuses) {
            try {
                const skip = (page - 1) * limit;
                const whereClause = statuses && statuses.length > 0 ? { status: (0, typeorm_1.In)(statuses) } : {};
                const [data, total] = yield this.ordersRepository.findAndCount({
                    where: whereClause,
                    order: {
                        create_date: "DESC"
                    },
                    relations: ["table", "delivery", "discount", "created_by", "items", "items.product", "items.product.category"],
                    take: limit,
                    skip: skip
                });
                return {
                    data,
                    total,
                    page,
                    limit
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    findAllItems(status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Need simple find with relations
                const where = {};
                if (status)
                    where.status = status;
                return yield database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem).find({
                    where,
                    relations: ["product", "order", "order.table"], // order.table for monitoring
                    order: {
                        // order by create date? OrdersItem doesn't have create_date, use order's
                        order: {
                            create_date: 'ASC'
                        }
                    }
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersRepository.findOne({
                    where: { id },
                    relations: [
                        "table",
                        "delivery",
                        "discount",
                        "created_by",
                        "items",
                        "items.product",
                        "items.details",
                        "payments"
                    ]
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByOrderNo(order_no) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersRepository.findOne({
                    where: { order_no },
                    relations: ["table", "delivery", "discount", "created_by"]
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Orders_1.Orders) : this.ordersRepository;
                return repo.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    // Transactional Create
    createFullOrder(data, items) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.manager.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                // 1. Save Order Header
                const savedOrder = yield transactionalEntityManager.save(Orders_1.Orders, data);
                // 2. Save Items and Details
                if (items && items.length > 0) {
                    for (const itemData of items) {
                        const item = new OrdersItem_1.OrdersItem();
                        item.order_id = savedOrder.id;
                        item.product_id = itemData.product_id;
                        item.quantity = itemData.quantity;
                        item.price = itemData.price;
                        item.discount_amount = itemData.discount_amount || 0;
                        item.total_price = itemData.total_price;
                        item.notes = itemData.notes;
                        const savedItem = yield transactionalEntityManager.save(OrdersItem_1.OrdersItem, item);
                        if (itemData.details && itemData.details.length > 0) {
                            for (const detailData of itemData.details) {
                                const detail = new OrdersDetail_1.OrdersDetail();
                                detail.orders_item_id = savedItem.id;
                                detail.detail_name = detailData.detail_name;
                                detail.extra_price = detailData.extra_price || 0;
                                yield transactionalEntityManager.save(OrdersDetail_1.OrdersDetail, detail);
                            }
                        }
                    }
                }
                return savedOrder;
            }));
        });
    }
    update(id, data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Orders_1.Orders) : this.ordersRepository;
                yield repo.update(id, data);
                const updatedOrder = yield repo.findOne({
                    where: { id },
                    relations: [
                        "table",
                        "delivery",
                        "discount",
                        "created_by",
                        "items",
                        "items.product",
                        "items.details",
                        "payments"
                    ]
                });
                if (!updatedOrder) {
                    throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการค้นหา");
                }
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(Orders_1.Orders) : this.ordersRepository;
                yield repo.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateItemStatus(itemId, status, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
                yield repo.update(itemId, { status });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findItemsByOrderId(orderId, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
            return yield repo.find({ where: { order_id: orderId } });
        });
    }
    updateStatus(orderId, status, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(Orders_1.Orders) : this.ordersRepository;
            yield repo.update(orderId, { status });
        });
    }
    updateAllItemsStatus(orderId, status, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
            yield repo.update({ order_id: orderId }, { status });
        });
    }
    createItem(data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
            return yield repo.save(data);
        });
    }
    updateItem(id, data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
            yield repo.update(id, data);
        });
    }
    deleteItem(id, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
            yield repo.delete(id);
        });
    }
    findItemById(id, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(OrdersItem_1.OrdersItem) : database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
            return yield repo.findOne({ where: { id }, relations: ["product"] });
        });
    }
}
exports.OrdersModels = OrdersModels;
