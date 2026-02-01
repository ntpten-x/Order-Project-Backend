import { AppDataSource } from "../../database/database";
import { PurchaseOrder, PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersItem } from "../../entity/stock/OrdersItem";
import { StockOrdersDetail } from "../../entity/stock/OrdersDetail";

export class StockOrdersModel {
    private ordersRepository = AppDataSource.getRepository(PurchaseOrder);

    // Creates an order and its items in a transaction
    // Creates an order and its items in a transaction
    async createOrderWithItems(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string, branchId?: string): Promise<PurchaseOrder> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const newOrder = queryRunner.manager.create(PurchaseOrder, {
                ordered_by_id: orderedById,
                status: PurchaseOrderStatus.PENDING,
                remark: remark,
                branch_id: branchId
            });
            const savedOrder = await queryRunner.manager.save(newOrder);

            const orderItems = items.map(item => queryRunner.manager.create(StockOrdersItem, {
                orders_id: savedOrder.id,
                ingredient_id: item.ingredient_id,
                quantity_ordered: item.quantity_ordered
            }));
            await queryRunner.manager.save(orderItems);

            await queryRunner.commitTransaction();

            // Return the complete order with relations (using the same transaction manager or separate generic find)
            // It is safe to use queryRunner.manager to fetch before release to ensure consistency
            return await this.findByIdInternal(savedOrder.id, queryRunner.manager);

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(filters?: { status?: PurchaseOrderStatus | PurchaseOrderStatus[] }, page: number = 1, limit: number = 50, branchId?: string): Promise<{ data: PurchaseOrder[], total: number, page: number, limit: number }> {
        // Use QueryBuilder for better control and optimization
        const { In } = require("typeorm");
        
        let query = this.ordersRepository.createQueryBuilder("order")
            .leftJoinAndSelect("order.ordered_by", "ordered_by")
            .leftJoinAndSelect("order.ordersItems", "ordersItems")
            .leftJoinAndSelect("ordersItems.ingredient", "ingredient")
            .leftJoinAndSelect("ingredient.unit", "unit")
            .leftJoinAndSelect("ordersItems.ordersDetail", "ordersDetail")
            .orderBy("order.create_date", "DESC");

        // Apply filters using dbHelpers pattern
        if (filters?.status) {
            if (Array.isArray(filters.status)) {
                query.andWhere("order.status IN (:...statuses)", { statuses: filters.status });
            } else {
                query.andWhere("order.status = :status", { status: filters.status });
            }
        }

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        // Use paginate helper for consistent pagination
        const skip = (page - 1) * limit;
        const [data, total] = await query
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        return {
            data,
            total,
            page,
            limit
        };
    }

    async updateOrderItems(orderId: string, newItems: { ingredient_id: string; quantity_ordered: number }[]): Promise<PurchaseOrder> {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            // 1. Fetch existing items
            const existingItems = await transactionalEntityManager.find(StockOrdersItem, {
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
                    const createdItem = transactionalEntityManager.create(StockOrdersItem, {
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

    async findById(id: string): Promise<PurchaseOrder | null> {
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

    async updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder | null> {
        const order = await this.ordersRepository.findOneBy({ id });
        if (!order) return null;

        order.status = status;
        return await this.ordersRepository.save(order);
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.ordersRepository.delete(id);
        return result.affected !== 0;
    }

    async confirmPurchase(orderId: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string): Promise<PurchaseOrder> {
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            // 1. Fetch Order Items
            const orderItems = await transactionalEntityManager.find(StockOrdersItem, {
                where: { orders_id: orderId },
                relations: { ordersDetail: true }
            });

            // 2. Update/Create OrdersDetail for each item
            for (const item of items) {
                const orderItem = orderItems.find(oi => oi.ingredient_id === item.ingredient_id);
                if (orderItem) {
                    let detail = orderItem.ordersDetail;
                    if (!detail) {
                        detail = transactionalEntityManager.create(StockOrdersDetail, {
                            orders_item_id: orderItem.id
                        });
                    }

                    detail.actual_quantity = item.actual_quantity;
                    detail.is_purchased = item.is_purchased;
                    detail.purchased_by_id = purchasedById;

                    await transactionalEntityManager.save(StockOrdersDetail, detail);
                }
            }

            // 3. Update Order Status to COMPLETED
            await transactionalEntityManager.update(PurchaseOrder, { id: orderId }, { status: PurchaseOrderStatus.COMPLETED });

            // 4. Return updated order
            return this.findByIdInternal(orderId, transactionalEntityManager);
        });
    }

    // internal helper for transaction
    private async findByIdInternal(id: string, manager: any): Promise<PurchaseOrder> {
        return await manager.findOne(PurchaseOrder, {
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
