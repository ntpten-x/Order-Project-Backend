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
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const SalesOrderDetail_1 = require("../../entity/pos/SalesOrderDetail");
const Products_1 = require("../../entity/pos/Products");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
const dbContext_1 = require("../../database/dbContext");
class OrdersModels {
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, statuses, orderType, searchTerm, branchId) {
            try {
                const skip = (page - 1) * limit;
                const ordersRepository = (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
                const qb = ordersRepository.createQueryBuilder("order")
                    .leftJoinAndSelect("order.table", "table")
                    .leftJoinAndSelect("order.delivery", "delivery")
                    .leftJoinAndSelect("order.discount", "discount")
                    .leftJoinAndSelect("order.created_by", "created_by")
                    .leftJoinAndSelect("order.items", "items")
                    .leftJoinAndSelect("items.product", "product")
                    .leftJoinAndSelect("product.category", "category")
                    .orderBy("order.create_date", "DESC")
                    .skip(skip)
                    .take(limit);
                if (branchId) {
                    qb.andWhere("order.branch_id = :branchId", { branchId });
                }
                if (statuses && statuses.length > 0) {
                    qb.andWhere("order.status IN (:...statuses)", { statuses });
                }
                if (orderType) {
                    qb.andWhere("order.order_type = :orderType", { orderType });
                }
                if (searchTerm) {
                    const search = `${searchTerm}%`;
                    qb.andWhere("(order.order_no ILIKE :search OR order.delivery_code ILIKE :search OR table.table_name ILIKE :search OR delivery.delivery_name ILIKE :search)", { search });
                }
                const [data, total] = yield qb.getManyAndCount();
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
    findAllSummary() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, statuses, orderType, query, branchId) {
            var _a, _b;
            try {
                const whereClauses = [];
                const params = [];
                if (statuses && statuses.length > 0) {
                    params.push(statuses);
                    whereClauses.push(`o.status::text = ANY($${params.length})`);
                }
                if (orderType) {
                    params.push(orderType);
                    whereClauses.push(`o.order_type::text = $${params.length}`);
                }
                if (query) {
                    params.push(`${query}%`);
                    const qIndex = params.length;
                    whereClauses.push(`(
                    o.order_no ILIKE $${qIndex}
                    OR o.delivery_code ILIKE $${qIndex}
                    OR t.table_name ILIKE $${qIndex}
                    OR d.delivery_name ILIKE $${qIndex}
                )`);
                }
                if (branchId) {
                    params.push(branchId);
                    whereClauses.push(`o.branch_id = $${params.length}`);
                }
                const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
                const countQuery = `
                SELECT COUNT(*)::int AS total
                FROM sales_orders o
                ${whereSql}
            `;
                const countResult = yield (0, dbContext_1.getDbManager)().query(countQuery, params);
                const total = (_b = (_a = countResult === null || countResult === void 0 ? void 0 : countResult[0]) === null || _a === void 0 ? void 0 : _a.total) !== null && _b !== void 0 ? _b : 0;
                const dataParams = [...params, limit, (page - 1) * limit];
                const limitIndex = params.length + 1;
                const offsetIndex = params.length + 2;
                const dataQuery = `
                SELECT
                    o.id,
                    o.order_no,
                    o.order_type,
                    o.status,
                    o.create_date,
                    o.total_amount,
                    o.delivery_code,
                    o.table_id,
                    o.delivery_id,
                    t.table_name AS table_name,
                    d.delivery_name AS delivery_name,
                    COALESCE(item_summary.items_summary, '{}'::jsonb) AS items_summary,
                    COALESCE(item_summary.items_count, 0) AS items_count
                FROM sales_orders o
                LEFT JOIN tables t ON t.id = o.table_id
                LEFT JOIN delivery d ON d.id = o.delivery_id
                LEFT JOIN LATERAL (
                    SELECT
                        jsonb_object_agg(s.category_name, s.qty) FILTER (WHERE s.category_name IS NOT NULL) AS items_summary,
                        SUM(s.qty) AS items_count
                    FROM (
                        SELECT
                            c.display_name AS category_name,
                            SUM(i.quantity)::int AS qty
                        FROM sales_order_item i
                        LEFT JOIN products p ON p.id = i.product_id
                        LEFT JOIN category c ON c.id = p.category_id
                        WHERE i.order_id = o.id AND i.status::text NOT IN ('Cancelled', 'cancelled')
                        GROUP BY c.display_name
                    ) s
                ) item_summary ON true
                ${whereSql}
                ORDER BY o.create_date DESC
                LIMIT $${limitIndex} OFFSET $${offsetIndex}
            `;
                const rows = yield (0, dbContext_1.getDbManager)().query(dataQuery, dataParams);
                const data = rows.map((row) => {
                    var _a;
                    return ({
                        id: row.id,
                        order_no: row.order_no,
                        order_type: row.order_type,
                        status: row.status,
                        create_date: row.create_date,
                        total_amount: Number(row.total_amount),
                        delivery_code: row.delivery_code,
                        table_id: row.table_id,
                        delivery_id: row.delivery_id,
                        table: row.table_name ? { table_name: row.table_name } : null,
                        delivery: row.delivery_name ? { delivery_name: row.delivery_name } : null,
                        items_summary: (_a = row.items_summary) !== null && _a !== void 0 ? _a : {},
                        items_count: Number(row.items_count || 0),
                    });
                });
                return {
                    data,
                    total,
                    page,
                    limit,
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    getStats(statuses, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder)
                    .createQueryBuilder("order")
                    .select("order.order_type", "type")
                    .addSelect("COUNT(order.id)", "count")
                    .where("order.status IN (:...statuses)", { statuses });
                if (branchId) {
                    stats.andWhere("order.branch_id = :branchId", { branchId });
                }
                const resultStats = yield stats.groupBy("order.order_type").getRawMany();
                const result = {
                    dineIn: 0,
                    takeaway: 0,
                    delivery: 0,
                    total: 0
                };
                resultStats.forEach(stat => {
                    const count = parseInt(stat.count);
                    if (stat.type === 'DineIn')
                        result.dineIn = count;
                    else if (stat.type === 'TakeAway')
                        result.takeaway = count;
                    else if (stat.type === 'Delivery')
                        result.delivery = count;
                    result.total += count;
                });
                return result;
            }
            catch (error) {
                throw error;
            }
        });
    }
    findAllItems(status_1) {
        return __awaiter(this, arguments, void 0, function* (status, page = 1, limit = 100, branchId) {
            try {
                // Need simple find with relations
                const where = {};
                if (status)
                    where.status = status;
                if (branchId)
                    where.order = { branch_id: branchId };
                const repo = (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
                const [data, total] = yield repo.findAndCount({
                    where,
                    relations: ["product", "product.category", "order", "order.table"], // order.table for monitoring
                    order: {
                        order: {
                            create_date: 'ASC'
                        }
                    },
                    take: limit,
                    skip: (page - 1) * limit
                });
                return { data, total, page, limit };
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = { id };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder).findOne({
                    where,
                    relations: [
                        "table",
                        "delivery",
                        "discount",
                        "created_by",
                        "items",
                        "items.product",
                        "items.product.category",
                        "items.details",
                        "payments",
                        "payments.payment_method"
                    ]
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByOrderNo(order_no, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder).findOne({
                    where: branchId ? { order_no, branch_id: branchId } : { order_no },
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
                const repo = manager ? manager.getRepository(SalesOrder_1.SalesOrder) : (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
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
            return yield (0, dbContext_1.runInTransaction)((transactionalEntityManager) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                // 1. Save Order Header
                const savedOrder = yield transactionalEntityManager.save(SalesOrder_1.SalesOrder, data);
                // 2. Save Items and Details
                if (items && items.length > 0) {
                    for (const itemData of items) {
                        const item = new SalesOrderItem_1.SalesOrderItem();
                        item.order_id = savedOrder.id;
                        item.product_id = itemData.product_id;
                        item.quantity = itemData.quantity;
                        const product = yield transactionalEntityManager.findOne(Products_1.Products, {
                            where: { id: itemData.product_id }
                        });
                        if (!product) {
                            throw new Error("ไม่พบสินค้า");
                        }
                        const detailsTotal = itemData.details
                            ? itemData.details.reduce((sum, d) => sum + (Number(d.extra_price) || 0), 0)
                            : 0;
                        item.price =
                            data.order_type === OrderEnums_1.OrderType.Delivery
                                ? Number((_a = product.price_delivery) !== null && _a !== void 0 ? _a : product.price)
                                : Number(product.price);
                        item.discount_amount = itemData.discount_amount || 0;
                        item.total_price = Math.max(0, (item.price + detailsTotal) * item.quantity - Number(item.discount_amount || 0));
                        item.notes = itemData.notes;
                        const savedItem = yield transactionalEntityManager.save(SalesOrderItem_1.SalesOrderItem, item);
                        if (itemData.details && itemData.details.length > 0) {
                            for (const detailData of itemData.details) {
                                const detail = new SalesOrderDetail_1.SalesOrderDetail();
                                detail.orders_item_id = savedItem.id;
                                detail.detail_name = detailData.detail_name;
                                detail.extra_price = detailData.extra_price || 0;
                                yield transactionalEntityManager.save(SalesOrderDetail_1.SalesOrderDetail, detail);
                            }
                        }
                    }
                }
                return savedOrder;
            }));
        });
    }
    update(id, data, manager, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(SalesOrder_1.SalesOrder) : (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
                if (branchId) {
                    yield repo.update({ id, branch_id: branchId }, data);
                }
                else {
                    yield repo.update(id, data);
                }
                const updatedOrder = yield repo.findOne({
                    where: branchId ? { id, branch_id: branchId } : { id },
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
    delete(id, manager, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(SalesOrder_1.SalesOrder) : (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
                if (branchId) {
                    yield repo.delete({ id, branch_id: branchId });
                }
                else {
                    yield repo.delete(id);
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateItemStatus(itemId, status, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
                yield repo.update(itemId, { status });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findItemsByOrderId(orderId, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            return yield repo.find({ where: { order_id: orderId } });
        });
    }
    updateStatus(orderId, status, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrder_1.SalesOrder) : (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
            yield repo.update(orderId, { status });
        });
    }
    updateAllItemsStatus(orderId, status, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            yield repo.update({ order_id: orderId }, { status });
        });
    }
    createItem(data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            return yield repo.save(data);
        });
    }
    updateItem(id, data, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            yield repo.update(id, data);
        });
    }
    deleteItem(id, manager) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            yield repo.delete(id);
        });
    }
    findItemById(id, manager, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const repo = manager ? manager.getRepository(SalesOrderItem_1.SalesOrderItem) : (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            const query = repo.createQueryBuilder("item")
                .leftJoinAndSelect("item.product", "product")
                .leftJoinAndSelect("item.details", "details")
                .leftJoinAndSelect("item.order", "order")
                .where("item.id = :id", { id });
            if (branchId) {
                query.andWhere("order.branch_id = :branchId", { branchId });
            }
            return query.getOne();
        });
    }
}
exports.OrdersModels = OrdersModels;
