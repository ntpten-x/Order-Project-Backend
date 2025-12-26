import { AppDataSource } from "../database/database";
import { Orders, OrderStatus } from "../entity/Orders";
import { OrdersItem } from "../entity/OrdersItem";

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
                    ordersDetail: {
                        purchased_by: true
                    }
                }
            },
            order: {
                create_date: "DESC"
            }
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
