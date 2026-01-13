import { AppDataSource } from "../../database/database";
import { Orders } from "../../entity/pos/Orders";
import { OrdersItem } from "../../entity/pos/OrdersItem";
import { OrdersDetail } from "../../entity/pos/OrdersDetail";
import { EntityManager } from "typeorm";

export class OrdersModels {
    private ordersRepository = AppDataSource.getRepository(Orders)

    async findAll(page: number = 1, limit: number = 50): Promise<{ data: Orders[], total: number, page: number, limit: number }> {
        try {
            const skip = (page - 1) * limit;
            const [data, total] = await this.ordersRepository.findAndCount({
                order: {
                    create_date: "DESC"
                },
                relations: ["table", "delivery", "discount", "created_by"],
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

    async findOne(id: string): Promise<Orders | null> {
        try {
            return this.ordersRepository.findOne({
                where: { id },
                relations: ["table", "delivery", "discount", "created_by", "items", "items.product", "items.details", "payments"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOneByOrderNo(order_no: string): Promise<Orders | null> {
        try {
            return this.ordersRepository.findOne({
                where: { order_no },
                relations: ["table", "delivery", "discount", "created_by"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: Orders): Promise<Orders> {
        try {
            return this.ordersRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    // Transactional Create
    async createFullOrder(data: Orders, items: any[]): Promise<Orders> {
        return await AppDataSource.manager.transaction(async (transactionalEntityManager: EntityManager) => {
            // 1. Save Order Header
            const savedOrder = await transactionalEntityManager.save(Orders, data);

            // 2. Save Items and Details
            if (items && items.length > 0) {
                for (const itemData of items) {
                    const item = new OrdersItem();
                    item.order_id = savedOrder.id;
                    item.product_id = itemData.product_id;
                    item.quantity = itemData.quantity;
                    item.price = itemData.price;
                    item.discount_amount = itemData.discount_amount || 0;
                    item.total_price = itemData.total_price;
                    item.notes = itemData.notes;

                    const savedItem = await transactionalEntityManager.save(OrdersItem, item);

                    if (itemData.details && itemData.details.length > 0) {
                        for (const detailData of itemData.details) {
                            const detail = new OrdersDetail();
                            detail.orders_item_id = savedItem.id;
                            detail.detail_name = detailData.detail_name;
                            detail.extra_price = detailData.extra_price || 0;

                            await transactionalEntityManager.save(OrdersDetail, detail);
                        }
                    }
                }
            }

            return savedOrder;
        });
    }

    async update(id: string, data: Orders): Promise<Orders> {
        try {
            await this.ordersRepository.update(id, data)
            const updatedOrder = await this.findOne(id)
            if (!updatedOrder) {
                throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการค้นหา")
            }
            return updatedOrder
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ordersRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
