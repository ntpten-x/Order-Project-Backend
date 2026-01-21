import { AppDataSource } from "../../database/database";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { EntityManager, In } from "typeorm";

export class OrdersModels {
    private ordersRepository = AppDataSource.getRepository(SalesOrder)

    async findAll(page: number = 1, limit: number = 50, statuses?: string[]): Promise<{ data: SalesOrder[], total: number, page: number, limit: number }> {
        try {
            const skip = (page - 1) * limit;
            const whereClause = statuses && statuses.length > 0 ? { status: In(statuses) } : {};

            const [data, total] = await this.ordersRepository.findAndCount({
                where: whereClause,
                order: {
                    create_date: "DESC"
                },
                relations: ["table", "delivery", "discount", "created_by", "items", "items.product", "items.product.category"],
                take: limit,
                skip: skip
            })

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

    async getStats(statuses: string[]): Promise<{ dineIn: number, takeaway: number, delivery: number, total: number }> {
        try {
            const stats = await this.ordersRepository
                .createQueryBuilder("order")
                .select("order.order_type", "type")
                .addSelect("COUNT(order.id)", "count")
                .where("order.status IN (:...statuses)", { statuses })
                .groupBy("order.order_type")
                .getRawMany();

            const result = {
                dineIn: 0,
                takeaway: 0,
                delivery: 0,
                total: 0
            };

            stats.forEach(stat => {
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

    async findAllItems(status?: any): Promise<SalesOrderItem[]> {
        try {
            // Need simple find with relations
            const where: any = {};
            if (status) where.status = status;

            return await AppDataSource.getRepository(SalesOrderItem).find({
                where,
                relations: ["product", "order", "order.table"], // order.table for monitoring
                order: {
                    // order by create date? SalesOrderItem doesn't have create_date, use order's
                    order: {
                        create_date: 'ASC'
                    }
                }
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<SalesOrder | null> {
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
                    "payments",
                    "payments.payment_method"
                ]
            })
        } catch (error) {
            throw error
        }
    }

    async findOneByOrderNo(order_no: string): Promise<SalesOrder | null> {
        try {
            return this.ordersRepository.findOne({
                where: { order_no },
                relations: ["table", "delivery", "discount", "created_by"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: SalesOrder, manager?: EntityManager): Promise<SalesOrder> {
        try {
            const repo = manager ? manager.getRepository(SalesOrder) : this.ordersRepository;
            return repo.save(data)
        } catch (error) {
            throw error
        }
    }

    // Transactional Create
    async createFullOrder(data: SalesOrder, items: any[]): Promise<SalesOrder> {
        return await AppDataSource.manager.transaction(async (transactionalEntityManager: EntityManager) => {
            // 1. Save Order Header
            const savedOrder = await transactionalEntityManager.save(SalesOrder, data);

            // 2. Save Items and Details
            if (items && items.length > 0) {
                for (const itemData of items) {
                    const item = new SalesOrderItem();
                    item.order_id = savedOrder.id;
                    item.product_id = itemData.product_id;
                    item.quantity = itemData.quantity;
                    item.price = itemData.price;
                    item.discount_amount = itemData.discount_amount || 0;
                    item.total_price = itemData.total_price;
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

    async update(id: string, data: SalesOrder, manager?: EntityManager): Promise<SalesOrder> {
        try {
            const repo = manager ? manager.getRepository(SalesOrder) : this.ordersRepository;
            await repo.update(id, data)
            const updatedOrder = await repo.findOne({
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
            })
            if (!updatedOrder) {
                throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการค้นหา")
            }
            return updatedOrder
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, manager?: EntityManager): Promise<void> {
        try {
            const repo = manager ? manager.getRepository(SalesOrder) : this.ordersRepository;
            await repo.delete(id)
        } catch (error) {
            throw error
        }
    }

    async updateItemStatus(itemId: string, status: any, manager?: EntityManager): Promise<void> {
        try {
            const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
            await repo.update(itemId, { status })
        } catch (error) {
            throw error
        }
    }

    async findItemsByOrderId(orderId: string, manager?: EntityManager): Promise<SalesOrderItem[]> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
        return await repo.find({ where: { order_id: orderId } });
    }

    async updateStatus(orderId: string, status: any, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrder) : this.ordersRepository;
        await repo.update(orderId, { status });
    }

    async updateAllItemsStatus(orderId: string, status: any, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
        await repo.update({ order_id: orderId }, { status });
    }

    async createItem(data: SalesOrderItem, manager?: EntityManager): Promise<SalesOrderItem> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
        return await repo.save(data);
    }

    async updateItem(id: string, data: Partial<SalesOrderItem>, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
        await repo.update(id, data);
    }

    async deleteItem(id: string, manager?: EntityManager): Promise<void> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
        await repo.delete(id);
    }

    async findItemById(id: string, manager?: EntityManager): Promise<SalesOrderItem | null> {
        const repo = manager ? manager.getRepository(SalesOrderItem) : AppDataSource.getRepository(SalesOrderItem);
        return await repo.findOne({ where: { id }, relations: ["product"] });
    }
}
