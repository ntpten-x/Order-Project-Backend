import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { Products } from "../../entity/pos/Products";
import { OrderType } from "../../entity/pos/OrderEnums";
import { EntityManager, In } from "typeorm";
import { getDbManager, getRepository, runInTransaction } from "../../database/dbContext";

export class OrdersModels {
    async findAll(page: number = 1, limit: number = 50, statuses?: string[], orderType?: string, searchTerm?: string, branchId?: string): Promise<{ data: SalesOrder[], total: number, page: number, limit: number }> {
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
                qb.andWhere(
                    "(order.order_no ILIKE :search OR order.delivery_code ILIKE :search OR table.table_name ILIKE :search OR delivery.delivery_name ILIKE :search)",
                    { search }
                );
            }

            const [data, total] = await qb.getManyAndCount();

            return {
                data,
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
        branchId?: string
    ): Promise<{ data: any[], total: number, page: number, limit: number }> {
        try {
            const whereClauses: string[] = [];
            const params: any[] = [];

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
            const countResult = await getDbManager().query(countQuery, params);
            const total = countResult?.[0]?.total ?? 0;

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

            const rows = await getDbManager().query(dataQuery, dataParams);
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

    async getStats(statuses: string[], branchId?: string): Promise<{ dineIn: number, takeaway: number, delivery: number, total: number }> {
        try {
            const stats = await getRepository(SalesOrder)
                .createQueryBuilder("order")
                .select("order.order_type", "type")
                .addSelect("COUNT(order.id)", "count")
                .where("order.status IN (:...statuses)", { statuses });

            if (branchId) {
                stats.andWhere("order.branch_id = :branchId", { branchId });
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
        branchId?: string
    ): Promise<{ data: SalesOrderItem[]; total: number; page: number; limit: number }> {
        try {
            // Need simple find with relations
            const where: any = {};
            if (status) where.status = status;
            if (branchId) where.order = { branch_id: branchId };

            const repo = getRepository(SalesOrderItem);
            const [data, total] = await repo.findAndCount({
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
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<SalesOrder | null> {
        try {
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }

            return getRepository(SalesOrder).findOne({
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
            return updatedOrder
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
