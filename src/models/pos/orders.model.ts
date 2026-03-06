import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { Products } from "../../entity/pos/Products";
import { OrderType } from "../../entity/pos/OrderEnums";
import { Shifts } from "../../entity/pos/Shifts";
import { EntityManager, In, SelectQueryBuilder } from "typeorm";
import { getRepository, runInTransaction } from "../../database/dbContext";
import { executeProfiledQuery } from "../../utils/queryProfiler";
import { PermissionScope } from "../../middleware/permission.middleware";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

type AccessContext = {
    scope?: PermissionScope;
    actorUserId?: string;
};

export interface ChannelStats {
    dineIn: number;
    takeaway: number;
    takeaway_waiting_payment: number;
    delivery: number;
    delivery_waiting_payment: number;
    total: number;
}

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
    private sanitizeUser<T extends { name?: string | null; username?: string | null; password?: string } | null | undefined>(
        user: T
    ): T {
        if (!user || typeof user !== "object") return user;

        const safeName = typeof user.name === "string" ? user.name.trim() : "";
        const safeUsername = typeof user.username === "string" ? user.username.trim() : "";
        const sanitizedUser = {
            ...user,
            name: safeName || safeUsername || undefined,
            username: safeUsername || undefined,
        } as T & { password?: string };

        delete sanitizedUser.password;
        return sanitizedUser as T;
    }

    private async resolveFallbackCreator(order: SalesOrder): Promise<void> {
        const branchId = (order as any).branch_id;
        if (!branchId || !order.create_date) return;

        const shift = await getRepository(Shifts)
            .createQueryBuilder("shift")
            .leftJoinAndSelect("shift.user", "user")
            .where("shift.branch_id = :branchId", { branchId })
            .andWhere("shift.open_time <= :orderDate", { orderDate: order.create_date })
            .andWhere("(shift.close_time IS NULL OR shift.close_time >= :orderDate)", { orderDate: order.create_date })
            .orderBy("shift.open_time", "DESC")
            .getOne();

        if (!shift?.user) return;

        order.created_by_id = order.created_by_id || shift.user_id;
        order.created_by = this.sanitizeUser(shift.user as any) as any;
    }

    private async sanitizeCreator(order: SalesOrder | null): Promise<SalesOrder | null> {
        if (!order) return order;

        if ("created_by" in order) {
            (order as any).created_by = this.sanitizeUser((order as any).created_by);
        }

        const hasCreatorIdentity = Boolean(order.created_by?.name || order.created_by?.username);
        if (!hasCreatorIdentity) {
            await this.resolveFallbackCreator(order);
        }

        return order;
    }

    private sanitizeCreators(orders: SalesOrder[]): SalesOrder[] {
        return orders.map((order) => {
            if ("created_by" in order) {
                (order as any).created_by = this.sanitizeUser((order as any).created_by);
            }
            return order;
        });
    }

    private applyFindAllFilters(
        qb: SelectQueryBuilder<SalesOrder>,
        statuses?: string[],
        orderType?: string,
        searchTerm?: string,
        branchId?: string,
        access?: AccessContext
    ): void {
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
            const sortOrder = createdSortToOrder(sortCreated);

            const baseFilterQb = ordersRepository.createQueryBuilder("order")
                .leftJoin("order.table", "table")
                .leftJoin("order.delivery", "delivery");
            this.applyFindAllFilters(baseFilterQb, statuses, orderType, searchTerm, branchId, access);

            const total = await baseFilterQb.clone().getCount();

            if (total === 0) {
                return {
                    data: [],
                    total,
                    page,
                    limit
                };
            }

            const idRows = await baseFilterQb
                .clone()
                .select("order.id", "id")
                .orderBy("order.create_date", sortOrder)
                .skip(skip)
                .take(limit)
                .getRawMany<{ id: string }>();

            const pagedIds = idRows.map((row) => row.id).filter(Boolean);
            if (pagedIds.length === 0) {
                return {
                    data: [],
                    total,
                    page,
                    limit
                };
            }

            const orderById = new Map<string, number>();
            pagedIds.forEach((id, index) => {
                orderById.set(id, index);
            });

            const data = await ordersRepository.createQueryBuilder("order")
                .leftJoinAndSelect("order.table", "table")
                .leftJoinAndSelect("order.delivery", "delivery")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .select([
                    "order.id",
                    "order.order_no",
                    "order.order_type",
                    "order.table_id",
                    "order.delivery_id",
                    "order.delivery_code",
                    "order.sub_total",
                    "order.discount_id",
                    "order.discount_amount",
                    "order.vat",
                    "order.total_amount",
                    "order.received_amount",
                    "order.change_amount",
                    "order.status",
                    "order.created_by_id",
                    "order.create_date",
                    "order.update_date",
                    "table.id",
                    "table.table_name",
                    "delivery.id",
                    "delivery.delivery_name",
                    "delivery.logo",
                    "items.id",
                    "items.order_id",
                    "items.product_id",
                    "items.quantity",
                    "items.price",
                    "items.total_price",
                    "items.discount_amount",
                    "items.notes",
                    "items.status",
                    "product.id",
                    "product.display_name",
                    "product.img_url",
                    "product.price",
                ])
                .where("order.id IN (:...pagedIds)", { pagedIds })
                .orderBy("order.create_date", sortOrder)
                .getMany();

            data.sort((a, b) => {
                const left = orderById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
                const right = orderById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
                return left - right;
            });
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
            const sortOrder = createdSortToOrder(sortCreated);
            const trimmedQuery = query?.trim();

            if (statuses && statuses.length > 0) {
                params.push(expandStatusVariants(statuses));
                whereClauses.push(`o.status::text = ANY($${params.length})`);
            }

            if (orderType) {
                params.push(expandOrderTypeVariants(orderType));
                whereClauses.push(`o.order_type::text = ANY($${params.length})`);
            }

            if (trimmedQuery) {
                params.push(`${trimmedQuery}%`);
                const qIndex = params.length;
                whereClauses.push(`(
                    o.order_no ILIKE $${qIndex}
                    OR o.delivery_code ILIKE $${qIndex}
                    OR EXISTS (
                        SELECT 1
                        FROM tables t
                        WHERE t.id = o.table_id
                          AND t.table_name ILIKE $${qIndex}
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM delivery d
                        WHERE d.id = o.delivery_id
                          AND d.delivery_name ILIKE $${qIndex}
                    )
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
                        o.delivery_id
                    FROM sales_orders o
                    ${whereSql}
                    ORDER BY o.create_date ${sortOrder}, o.order_no ${sortOrder}, o.id ${sortOrder}
                    LIMIT $${limitIndex} OFFSET $${offsetIndex}
                ),
                item_agg AS (
                    SELECT
                        order_id,
                        SUM(i.quantity)::int AS items_count
                    FROM sales_order_item i
                    INNER JOIN base_orders bo ON bo.id = i.order_id
                    WHERE i.status NOT IN ('Cancelled', 'cancelled')
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
                    t.table_name,
                    d.delivery_name,
                    d.logo,
                    COALESCE(ia.items_count, 0) AS items_count
                FROM base_orders bo
                LEFT JOIN tables t ON t.id = bo.table_id
                LEFT JOIN delivery d ON d.id = bo.delivery_id
                LEFT JOIN item_agg ia ON ia.order_id = bo.id
                ORDER BY bo.create_date ${sortOrder}, bo.order_no ${sortOrder}, bo.id ${sortOrder}
            `;

            const rows = await executeProfiledQuery<any>(
                "orders.summary.data",
                dataQuery,
                dataParams
            );

            console.error(`[DEBUG] Final SQL Query:`, dataQuery);
            console.error(`[DEBUG] SQL Result (First 3):`, rows.slice(0, 3).map(r => ({ id: r.id, no: r.order_no, date: r.create_date })));

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
                delivery: row.delivery_name ? { delivery_name: row.delivery_name, logo: row.logo } : null,
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

    async getStats(statuses: string[], branchId?: string, access?: AccessContext): Promise<ChannelStats> {
        try {
            const expandedStatuses = expandStatusVariants(statuses);
            const whereClauses: string[] = ["o.status::text = ANY($1)"];
            const params: any[] = [expandedStatuses];

            if (branchId) {
                params.push(branchId);
                whereClauses.push(`o.branch_id = $${params.length}`);
            }
            if (access?.scope === "none") {
                whereClauses.push("1=0");
            }
            if (access?.scope === "own" && access.actorUserId) {
                params.push(access.actorUserId);
                whereClauses.push(`o.created_by_id = $${params.length}`);
            }

            const sql = `
                SELECT
                    COUNT(*) FILTER (WHERE o.order_type = 'DineIn')::int AS "dineIn",
                    COUNT(*) FILTER (WHERE o.order_type = 'TakeAway')::int AS "takeaway",
                    COUNT(*) FILTER (WHERE o.order_type = 'TakeAway' AND LOWER(o.status::text) = 'waitingforpayment')::int AS "takeaway_waiting_payment",
                    COUNT(*) FILTER (WHERE o.order_type = 'Delivery')::int AS "delivery",
                    COUNT(*) FILTER (WHERE o.order_type = 'Delivery' AND LOWER(o.status::text) = 'waitingforpayment')::int AS "delivery_waiting_payment",
                    COUNT(*)::int AS "total"
                FROM sales_orders o
                WHERE ${whereClauses.join(" AND ")}
            `;

            const result = await executeProfiledQuery<{
                dineIn: number;
                takeaway: number;
                takeaway_waiting_payment: number;
                delivery: number;
                delivery_waiting_payment: number;
                total: number;
            }>("orders.stats.active", sql, params);

            const row = result?.[0];
            return {
                dineIn: Number(row?.dineIn ?? 0),
                takeaway: Number(row?.takeaway ?? 0),
                takeaway_waiting_payment: Number(row?.takeaway_waiting_payment ?? 0),
                delivery: Number(row?.delivery ?? 0),
                delivery_waiting_payment: Number(row?.delivery_waiting_payment ?? 0),
                total: Number(row?.total ?? 0),
            };
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

            return await this.sanitizeCreator(order);
        } catch (error) {
            throw error
        }
    }

    async findOneByOrderNo(order_no: string, branchId?: string): Promise<SalesOrder | null> {
        try {
            const order = await getRepository(SalesOrder).findOne({
                where: branchId ? ({ order_no, branch_id: branchId } as any) : { order_no },
                relations: ["table", "delivery", "discount", "created_by"]
            });

            return await this.sanitizeCreator(order);
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
            return await this.sanitizeCreator(updatedOrder) as SalesOrder
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
