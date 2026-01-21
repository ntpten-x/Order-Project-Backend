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
exports.StockOrdersModel = void 0;
const database_1 = require("../../database/database");
const Orders_1 = require("../../entity/stock/Orders");
const OrdersItem_1 = require("../../entity/stock/OrdersItem");
const OrdersDetail_1 = require("../../entity/stock/OrdersDetail");
class StockOrdersModel {
    constructor() {
        this.ordersRepository = database_1.AppDataSource.getRepository(Orders_1.StockOrders);
    }
    // Creates an order and its items in a transaction
    // Creates an order and its items in a transaction
    createOrderWithItems(orderedById, items, remark) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryRunner = database_1.AppDataSource.createQueryRunner();
            yield queryRunner.connect();
            yield queryRunner.startTransaction();
            try {
                const newOrder = queryRunner.manager.create(Orders_1.StockOrders, {
                    ordered_by_id: orderedById,
                    status: Orders_1.OrderStatus.PENDING,
                    remark: remark
                });
                const savedOrder = yield queryRunner.manager.save(newOrder);
                const orderItems = items.map(item => queryRunner.manager.create(OrdersItem_1.StockOrdersItem, {
                    orders_id: savedOrder.id,
                    ingredient_id: item.ingredient_id,
                    quantity_ordered: item.quantity_ordered
                }));
                yield queryRunner.manager.save(orderItems);
                yield queryRunner.commitTransaction();
                // Return the complete order with relations (using the same transaction manager or separate generic find)
                // It is safe to use queryRunner.manager to fetch before release to ensure consistency
                return this.findByIdInternal(savedOrder.id, queryRunner.manager);
            }
            catch (error) {
                yield queryRunner.rollbackTransaction();
                throw error;
            }
            finally {
                yield queryRunner.release();
            }
        });
    }
    findAll(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, page = 1, limit = 50) {
            // To support "IN" query with TypeORM find options, we need the "In" operator
            // Importing In from typeorm
            const { In } = require("typeorm");
            const skip = (page - 1) * limit;
            const findOptions = {
                relations: {
                    ordered_by: true,
                    ordersItems: {
                        ingredient: {
                            unit: true
                        },
                        ordersDetail: true
                    }
                },
                order: {
                    create_date: "DESC"
                },
                take: limit,
                skip: skip
            };
            if (filters === null || filters === void 0 ? void 0 : filters.status) {
                if (Array.isArray(filters.status)) {
                    findOptions.where = { status: In(filters.status) };
                }
                else {
                    findOptions.where = { status: filters.status };
                }
            }
            const [data, total] = yield this.ordersRepository.findAndCount(findOptions);
            return {
                data,
                total,
                page,
                limit
            };
        });
    }
    updateOrderItems(orderId, newItems) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                // 1. Fetch existing items
                const existingItems = yield transactionalEntityManager.find(OrdersItem_1.StockOrdersItem, {
                    where: { orders_id: orderId }
                });
                // 2. Identify items to delete (in DB but not in newItems)
                const newItemIds = newItems.map(i => i.ingredient_id);
                const itemsToDelete = existingItems.filter(item => !newItemIds.includes(item.ingredient_id));
                if (itemsToDelete.length > 0) {
                    yield transactionalEntityManager.remove(itemsToDelete);
                }
                // 3. Identify items to update or create
                for (const newItem of newItems) {
                    const existingItem = existingItems.find(item => item.ingredient_id === newItem.ingredient_id);
                    if (existingItem) {
                        // Update existing
                        if (existingItem.quantity_ordered !== newItem.quantity_ordered) {
                            existingItem.quantity_ordered = newItem.quantity_ordered;
                            yield transactionalEntityManager.save(existingItem);
                        }
                    }
                    else {
                        // Create new
                        const createdItem = transactionalEntityManager.create(OrdersItem_1.StockOrdersItem, {
                            orders_id: orderId,
                            ingredient_id: newItem.ingredient_id,
                            quantity_ordered: newItem.quantity_ordered
                        });
                        yield transactionalEntityManager.save(createdItem);
                    }
                }
                // 4. Return updated order
                return this.findByIdInternal(orderId, transactionalEntityManager);
            }));
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.ordersRepository.findOne({
                where: { id },
                relations: {
                    ordered_by: true,
                    ordersItems: {
                        ingredient: {
                            unit: true
                        },
                        ordersDetail: {
                            purchased_by: true
                        }
                    }
                }
            });
        });
    }
    updateStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = yield this.ordersRepository.findOneBy({ id });
            if (!order)
                return null;
            order.status = status;
            return yield this.ordersRepository.save(order);
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.ordersRepository.delete(id);
            return result.affected !== 0;
        });
    }
    confirmPurchase(orderId, items, purchasedById) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield database_1.AppDataSource.transaction((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                // 1. Fetch Order Items
                const orderItems = yield transactionalEntityManager.find(OrdersItem_1.StockOrdersItem, {
                    where: { orders_id: orderId },
                    relations: { ordersDetail: true }
                });
                // 2. Update/Create OrdersDetail for each item
                for (const item of items) {
                    const orderItem = orderItems.find(oi => oi.ingredient_id === item.ingredient_id);
                    if (orderItem) {
                        let detail = orderItem.ordersDetail;
                        if (!detail) {
                            detail = transactionalEntityManager.create(OrdersDetail_1.StockOrdersDetail, {
                                orders_item_id: orderItem.id
                            });
                        }
                        detail.actual_quantity = item.actual_quantity;
                        detail.is_purchased = item.is_purchased;
                        detail.purchased_by_id = purchasedById;
                        yield transactionalEntityManager.save(OrdersDetail_1.StockOrdersDetail, detail);
                    }
                }
                // 3. Update Order Status to COMPLETED
                yield transactionalEntityManager.update(Orders_1.StockOrders, { id: orderId }, { status: Orders_1.OrderStatus.COMPLETED });
                // 4. Return updated order
                return this.findByIdInternal(orderId, transactionalEntityManager);
            }));
        });
    }
    // internal helper for transaction
    findByIdInternal(id, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield manager.findOne(Orders_1.StockOrders, {
                where: { id },
                relations: {
                    ordered_by: true,
                    ordersItems: {
                        ingredient: {
                            unit: true
                        },
                        ordersDetail: {
                            purchased_by: true
                        }
                    }
                }
            });
        });
    }
}
exports.StockOrdersModel = StockOrdersModel;
