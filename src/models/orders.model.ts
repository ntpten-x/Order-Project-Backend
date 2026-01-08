import { AppDataSource } from "../database/database";
import { Orders, OrderStatus } from "../entity/Orders";
import { OrdersItem } from "../entity/OrdersItem";
import { OrdersDetail } from "../entity/OrdersDetail";

export class OrdersModel {
    private ordersRepository = AppDataSource.getRepository(Orders);

    // Creates an order and its items in a transaction
    async createOrderWithItems(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string): Promise<Orders> {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            const newOrder = transactionalEntityManager.create(Orders, {
                ordered_by_id: orderedById,
                status: OrderStatus.PENDING,
                remark: remark
            });
            const savedOrder = await transactionalEntityManager.save(newOrder);

            const orderItems = items.map(item => transactionalEntityManager.create(OrdersItem, {
                orders_id: savedOrder.id,
                ingredient_id: item.ingredient_id,
                quantity_ordered: item.quantity_ordered
            }));
            await transactionalEntityManager.save(orderItems);

            return this.findByIdInternal(savedOrder.id, transactionalEntityManager);
        });
    }

    async findAll(): Promise<Orders[]> {
        return await this.ordersRepository.find({
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
            }
        });
    }

    async updateOrderItems(orderId: string, newItems: { ingredient_id: string; quantity_ordered: number }[]): Promise<Orders> {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            // 1. Fetch existing items
            const existingItems = await transactionalEntityManager.find(OrdersItem, {
                where: { orders_id: orderId }
            });

            // 2. Identify items to delete (in DB but not in newItems)
            const newItemIds = newItems.map(i => i.ingredient_id);
            const itemsToDelete = existingItems.filter(item => !newItemIds.includes(item.ingredient_id));

            if (itemsToDelete.length > 0) {
                await transactionalEntityManager.remove(itemsToDelete);
            }

            // 3. Identify items to update or create
            for (const newItem of newItems) {
                const existingItem = existingItems.find(item => item.ingredient_id === newItem.ingredient_id);

                if (existingItem) {
                    // Update existing
                    if (existingItem.quantity_ordered !== newItem.quantity_ordered) {
                        existingItem.quantity_ordered = newItem.quantity_ordered;
                        await transactionalEntityManager.save(existingItem);
                    }
                } else {
                    // Create new
                    const createdItem = transactionalEntityManager.create(OrdersItem, {
                        orders_id: orderId,
                        ingredient_id: newItem.ingredient_id,
                        quantity_ordered: newItem.quantity_ordered
                    });
                    await transactionalEntityManager.save(createdItem);
                }
            }

            // 4. Return updated order
            return this.findByIdInternal(orderId, transactionalEntityManager);
        });
    }

    async findById(id: string): Promise<Orders | null> {
        return await this.ordersRepository.findOne({
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
    }

    async updateStatus(id: string, status: OrderStatus): Promise<Orders | null> {
        const order = await this.ordersRepository.findOneBy({ id });
        if (!order) return null;

        order.status = status;
        return await this.ordersRepository.save(order);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.ordersRepository.delete(id);
        return result.affected !== 0;
    }

    async confirmPurchase(orderId: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string): Promise<Orders> {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            // 1. Fetch Order Items
            const orderItems = await transactionalEntityManager.find(OrdersItem, {
                where: { orders_id: orderId },
                relations: { ordersDetail: true }
            });

            // 2. Update/Create OrdersDetail for each item
            for (const item of items) {
                const orderItem = orderItems.find(oi => oi.ingredient_id === item.ingredient_id);
                if (orderItem) {
                    let detail = orderItem.ordersDetail;
                    if (!detail) {
                        detail = transactionalEntityManager.create(OrdersDetail, {
                            orders_item_id: orderItem.id
                        });
                    }

                    detail.actual_quantity = item.actual_quantity;
                    detail.is_purchased = item.is_purchased;
                    detail.purchased_by_id = purchasedById;

                    await transactionalEntityManager.save(OrdersDetail, detail);
                }
            }

            // 3. Update Order Status to COMPLETED
            await transactionalEntityManager.update(Orders, { id: orderId }, { status: OrderStatus.COMPLETED });

            // 4. Return updated order
            return this.findByIdInternal(orderId, transactionalEntityManager);
        });
    }

    // internal helper for transaction
    private async findByIdInternal(id: string, manager: any): Promise<Orders> {
        return await manager.findOne(Orders, {
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
    }
}
