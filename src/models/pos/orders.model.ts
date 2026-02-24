import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { Products } from "../../entity/pos/Products";
import { OrderType } from "../../entity/pos/OrderEnums";
import { EntityManager, In } from "typeorm";
import { getDbManager, getRepository, runInTransaction } from "../../database/dbContext";
import { executeProfiledQuery } from "../../utils/queryProfiler";
import { PermissionScope } from "../../middleware/permission.middleware";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

const ORDER_STATUS_VARIANTS: Record<string, string[]> = {
    // "Cooking/Served" are deprecated workflow states and are treated as Pending.
    pending: ["Pending", "pending", "Cooking", "Served"],
    cooking: ["Pending", "pending", "Cooking", "Served"],
    served: ["Pending", "pending", "Cooking", "Served"],
    waitingforpayment: ["WaitingForPayment"],
    paid: ["Paid"],
    completed: ["Completed", "completed"],
    cancelled: ["Cancelled", "cancelled"],
};

const ORDER_TYPE_VARIANTS: Record<string, string[]> = {
    dinein: ["DineIn"],
    takeaway: ["TakeAway"],
    delivery: ["Delivery"],
};

function expandStatusVariants(statuses: string[]): string[] {
    const expanded = statuses.flatMap((status) => {
        const key = String(status).trim().toLowerCase();
        return ORDER_STATUS_VARIANTS[key] ?? [String(status).trim()];
    });
    return Array.from(new Set(expanded.filter(Boolean)));
}

function expandOrderTypeVariants(orderType: string): string[] {
    const key = String(orderType).trim().toLowerCase();
    return ORDER_TYPE_VARIANTS[key] ?? [String(orderType).trim()];
}

export class OrdersModels {
    private sanitizeCreator(order: SalesOrder | null): SalesOrder | null {
        if (order?.created_by && typeof order.created_by === "object") {
            delete (order.created_by as any).password;
        }
        return order;
    }

    private sanitizeCreators(orders: SalesOrder[]): SalesOrder[] {
        return orders.map((order) => this.sanitizeCreator(order) as SalesOrder);
    }

    async findAll(
        page: number = 1,
        limit: number = 50,
        statuses?: string[],
        orderType?: string,
        searchTerm?: string,
        branchId?: string,
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: SalesOrder[], total: number, page: number, limit: number }> {
        try {
            const skip = (page - 1) * limit;
            const ordersRepository = getRepository(SalesOrder);
            const qb = ordersRepository.createQueryBuilder("order")
                .leftJoinAndSelect("order.table", "table")
                .leftJoinAndSelect("order.delivery", "delivery")
                .leftJoinAndSelect("order.discount", "discount")
                .leftJoinAndSelect("order.created_by", "created_by")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .leftJoinAndSelect("product.category", "category")
                .orderBy("order.create_date", createdSortToOrder(sortCreated))
                .skip(skip)
                .take(limit);

            if (branchId) {
                qb.andWhere("order.branch_id = :branchId", { branchId });
            }

            if (statuses && statuses.length > 0) {
                const expandedStatuses = expandStatusVariants(statuses);
                qb.andWhere("order.status IN (:...statuses)", { statuses: expandedStatuses });
            }

            if (orderType) {
                const expandedOrderTypes = expandOrderTypeVariants(orderType);
                qb.andWhere("order.order_type IN (:...orderTypes)", { orderTypes: expandedOrderTypes });
            }

            if (searchTerm) {
                const search = `${searchTerm}%`;
                qb.andWhere(
                    "(order.order_no ILIKE :search OR order.delivery_code ILIKE :search OR table.table_name ILIKE :search OR delivery.delivery_name ILIKE :search)",
                    { search }
                );
            }
            if (access?.scope === "none") {
                qb.andWhere("1=0");
            }
            if (access?.scope === "own" && access.actorUserId) {
                qb.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
            }

            const [data, total] = await qb.getManyAndCount();
            const sanitizedData = this.sanitizeCreators(data);

            return {
                data: sanitizedData,
                total,
                page,
                limit
            }
        } catch (error) {
            throw error
        }
    }

    async findAllSummary(
        page: number = 1,
        limit: number = 50,
        statuses?: string[],
        orderType?: string,
        query?: string,
        branchId?: string,
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: any[], total: number, page: number, limit: number }> {
        try {
            const whereClauses: string[] = [];
            const params: any[] = [];

            if (statuses && statuses.length > 0) {
                params.push(expandStatusVariants(statuses));
                whereClauses.push(`o.status::text = ANY($${params.length})`);
            }

            if (orderType) {
                params.push(expandOrderTypeVariants(orderType));
                whereClauses.push(`o.order_type::text = ANY($${params.length})`);
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
            if (access?.scope === "none") {
                whereClauses.push(`1=0`);
            }
            if (access?.scope === "own" && access.actorUserId) {
                params.push(access.actorUserId);
                whereClauses.push(`o.created_by_id = $${params.length}`);
            }

            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

            const countQuery = `
                SELECT COUNT(*)::int AS total
                FROM sales_orders o
                LEFT JOIN tables t ON t.id = o.table_id
                LEFT JOIN delivery d ON d.id = o.delivery_id
                ${whereSql}
            `;
            const countResult = await executeProfiledQuery<{ total: number }>(
                "orders.summary.count",
                countQuery,
                params
            );
            const total = countResult?.[0]?.total ?? 0;

            const dataParams = [...params, limit, (page - 1) * limit];
            const limitIndex = params.length + 1;
            const offsetIndex = params.length + 2;

            const dataQuery = `
                WITH base_orders AS (
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
                        d.delivery_name AS delivery_name
                    FROM sales_orders o
                    LEFT JOIN tables t ON t.id = o.table_id
                    LEFT JOIN delivery d ON d.id = o.delivery_id
                    ${whereSql}
                    ORDER BY o.create_date ${createdSortToOrder(sortCreated)}
                    LIMIT $${limitIndex} OFFSET $${offsetIndex}
                ),
                item_agg_raw AS (
                    SELECT
                        i.order_id,
                        c.display_name AS category_name,
                        SUM(i.quantity)::int AS qty
                    FROM sales_order_item i
                    INNER JOIN base_orders bo ON bo.id = i.order_id
                    LEFT JOIN products p ON p.id = i.product_id
                    LEFT JOIN category c ON c.id = p.category_id
                    WHERE i.status::text NOT IN ('Cancelled', 'cancelled')
                    GROUP BY i.order_id, c.display_name
                ),
                item_agg AS (
                    SELECT
                        order_id,
                        jsonb_object_agg(category_name, qty) FILTER (WHERE category_name IS NOT NULL) AS items_summary,
                        SUM(qty)::int AS items_count
                    FROM item_agg_raw
                    GROUP BY order_id
                )
                SELECT
                    bo.id,
                    bo.order_no,
                    bo.order_type,
                    bo.status,
                    bo.create_date,
                    bo.total_amount,
                    bo.delivery_code,
                    bo.table_id,
                    bo.delivery_id,
                    bo.table_name,
                    bo.delivery_name,
                    COALESCE(ia.items_summary, '{}'::jsonb) AS items_summary,
                    COALESCE(ia.items_count, 0) AS items_count
                FROM base_orders bo
                LEFT JOIN item_agg ia ON ia.order_id = bo.id
                ORDER BY bo.create_date ${createdSortToOrder(sortCreated)}
            `;

            const rows = await executeProfiledQuery<any>(
                "orders.summary.data",
                dataQuery,
                dataParams
            );
            const data = rows.map((row: any) => ({
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
                items_summary: row.items_summary ?? {},
                items_count: Number(row.items_count || 0),
            }));

            return {
                data,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw error;
        }
    }

    async getStats(statuses: string[], branchId?: string, access?: AccessContext): Promise<{ dineIn: number, takeaway: number, delivery: number, total: number }> {
        try {
            const expandedStatuses = expandStatusVariants(statuses);
            const stats = await getRepository(SalesOrder)
                .createQueryBuilder("order")
                .select("order.order_type", "type")
                .addSelect("COUNT(order.id)", "count")
                .where("order.status IN (:...statuses)", { statuses: expandedStatuses });

            if (branchId) {
                stats.andWhere("order.branch_id = :branchId", { branchId });
            }
            if (access?.scope === "none") {
                stats.andWhere("1=0");
            }
            if (access?.scope === "own" && access.actorUserId) {
                stats.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
            }

            const resultStats = await stats.groupBy("order.order_type").getRawMany();

            const result = {
                dineIn: 0,
                takeaway: 0,
                delivery: 0,
                total: 0
            };

            resultStats.forEach(stat => {
                const count = parseInt(stat.count);
                if (stat.type === 'DineIn') result.dineIn = count;
                else if (stat.type === 'TakeAway') result.takeaway = count;
                else if (stat.type === 'Delivery') result.delivery = count;
                result.total += count;
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    async findAllItems(
        status?: any,
        page: number = 1,
        limit: number = 100,
        branchId?: string,
        access?: AccessContext,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: SalesOrderItem[]; total: number; page: number; limit: number }> {
        try {
            // Need simple find with relations
            const where: any = {};
            if (status) where.status = status;
            if (branchId || (access?.scope === "own" && access.actorUserId)) {
                where.order = {
                    ...(branchId ? { branch_id: branchId } : {}),
                    ...(access?.scope === "own" && access.actorUserId ? { created_by_id: access.actorUserId } : {}),
                };
            }
            if (access?.scope === "none") {
                where.id = "__none__";
            }

            const repo = getRepository(SalesOrderItem);
            const [data, total] = await repo.findAndCount({
                where,
                relations: ["product", "product.category", "order", "order.table"], // order.table for monitoring
                order: {
                    order: {
                        create_date: createdSortToOrder(sortCreated)
                    }
                },
                take: limit,
                skip: (page - 1) * limit
            });
            return { data, total, page, limit };
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrder | null> {
        try {
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }
            if (access?.scope === "own" && access.actorUserId) {
                where.created_by_id = access.actorUserId;
            }

            const order = await getRepository(SalesOrder).findOne({
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
            })

            return this.sanitizeCreator(order);
        } catch (error) {
            throw error
        }
    }

    async findOneByOrderNo(order_no: string, branchId?: string): Promise<SalesOrder | null> {
        try {
            return getRepository(SalesOrder).findOne({
                where: branchId ? ({ order_no, branch_id: branchId } as any) : { order_no },
                relations: ["table", "delivery", "discount", "created_by"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: SalesOrder, manager?: EntityManager): Promise<SalesOrder> {
        try {
            const repo = manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
            return repo.save(data)
        } catch (error) {
            throw error
        }
    }

    // Transactional Create
    async createFullOrder(data: SalesOrder, items: any[]): Promise<SalesOrder> {
        return await runInTransaction(async (transactionalEntityManager: EntityManager) => {
            // 1. Save Order Header
            const savedOrder = await transactionalEntityManager.save(SalesOrder, data);

            // 2. Save Items and Details
            if (items && items.length > 0) {
                for (const itemData of items) {
                    const item = new SalesOrderItem();
                    item.order_id = savedOrder.id;
                    item.product_id = itemData.product_id;
                    item.quantity = itemData.quantity;

                    const product = await transactionalEntityManager.findOne(Products, {
                        where: { id: itemData.product_id }
                    });
                    if (!product) {
                        throw new Error("ไม่พบสินค้า");
                    }

                    const detailsTotal = itemData.details
                        ? itemData.details.reduce((sum: number, d: any) => sum + (Number(d.extra_price) || 0), 0)
                        : 0;

                    item.price =
                        data.order_type === OrderType.Delivery
                            ? Number((product as any).price_delivery ?? product.price)
                            : Number(product.price);
                    item.discount_amount = itemData.discount_amount || 0;
                    item.total_price = Math.max(0, (item.price + detailsTotal) * item.quantity - Number(item.discount_amount || 0));
                    item.notes = itemData.notes;

                    const savedItem = await transactionalEntityManager.save(SalesOrderItem, item);

                    if (itemData.details && itemData.details.length > 0) {
                        for (const detailData of itemData.details) {
                            const detail = new SalesOrderDetail();
                            detail.orders_item_id = savedItem.id;
                            detail.detail_name = detailData.detail_name;
                            detail.extra_price = detailData.extra_price || 0;

                            await transactionalEntityManager.save(SalesOrderDetail, detail);
                        }
                    }
                }
            }

            return savedOrder;
        });
    }

    async update(id: string, data: SalesOrder, manager?: EntityManager, branchId?: string): Promise<SalesOrder> {
        try {
            const repo = manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
            if (branchId) {
                await repo.update({ id, branch_id: branchId } as any, data)
            } else {
                await repo.update(id, data)
            }
            const updatedOrder = await repo.findOne({
                where: branchId ? ({ id, branch_id: branchId } as any) : { id },
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
            })
            if (!updatedOrder) {
                throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการค้นหา")
            }
            return this.sanitizeCreator(updatedOrder) as SalesOrder
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, manager?: EntityManager, branchId?: string): Promise<void> {
        try {
            const repo = manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
            if (branchId) {
                await repo.delete({ id, branch_id: branchId } as any)
            } else {
                await repo.delete(id)
            }
        } catch (error) {
            throw error
        }
    }

    async updateItemStatus(itemId: string, status: any, manager?: EntityManager): Promise<void> {
        try {
            const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
            await repo.update(itemId, { status })
        } catch (error) {
            throw error
        }
    }

    async findItemsByOrderId(orderId: string, manager?: EntityManager): Promise<SalesOrderItem[]> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
        return await repo.find({ where: { order_id: orderId } });
    }

    async updateStatus(orderId: string, status: any, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
        await repo.update(orderId, { status });
    }

    async updateAllItemsStatus(orderId: string, status: any, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
        await repo.update({ order_id: orderId }, { status });
    }

    async createItem(data: SalesOrderItem, manager?: EntityManager): Promise<SalesOrderItem> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
        return await repo.save(data);
    }

    async updateItem(id: string, data: Partial<SalesOrderItem>, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
        await repo.update(id, data);
    }

    async deleteItem(id: string, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);
        await repo.delete(id);
    }

    async findItemById(id: string, manager?: EntityManager, branchId?: string): Promise<SalesOrderItem | null> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : getRepository(SalesOrderItem);

        const query = repo.createQueryBuilder("item")
            .leftJoinAndSelect("item.product", "product")
            .leftJoinAndSelect("item.details", "details")
            .leftJoinAndSelect("item.order", "order")
            .where("item.id = :id", { id });

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }
}
