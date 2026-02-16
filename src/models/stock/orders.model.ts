import { PurchaseOrder, PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersItem } from "../../entity/stock/OrdersItem";
import { StockOrdersDetail } from "../../entity/stock/OrdersDetail";
import { getRepository, runInTransaction } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class StockOrdersModel {
    // Creates an order and its items in a transaction
    async createOrderWithItems(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string, branchId?: string): Promise<PurchaseOrder> {
        return runInTransaction(async (manager) => {
            const newOrder = manager.create(PurchaseOrder, {
                ordered_by_id: orderedById,
                status: PurchaseOrderStatus.PENDING,
                remark,
                branch_id: branchId,
            });

            const savedOrder = await manager.save(newOrder);

            const orderItems = items.map((item) =>
                manager.create(StockOrdersItem, {
                    orders_id: savedOrder.id,
                    ingredient_id: item.ingredient_id,
                    quantity_ordered: item.quantity_ordered,
                })
            );

            await manager.save(orderItems);

            return this.findByIdInternal(savedOrder.id, manager, branchId);
        });
    }

    async findAll(
        filters?: { status?: PurchaseOrderStatus | PurchaseOrderStatus[] },
        page: number = 1,
        limit: number = 50,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: PurchaseOrder[], total: number, page: number, limit: number }> {
        // Use QueryBuilder for better control and optimization
        const ordersRepository = getRepository(PurchaseOrder);
        let query = ordersRepository.createQueryBuilder("order")
            .leftJoinAndSelect("order.ordered_by", "ordered_by")
            .leftJoinAndSelect("order.ordersItems", "ordersItems")
            .leftJoinAndSelect("ordersItems.ingredient", "ingredient")
            .leftJoinAndSelect("ingredient.unit", "unit")
            .leftJoinAndSelect("ordersItems.ordersDetail", "ordersDetail")
            .orderBy("order.create_date", createdSortToOrder(sortCreated));

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

    async updateOrderItems(orderId: string, newItems: { ingredient_id: string; quantity_ordered: number }[], branchId?: string): Promise<PurchaseOrder> {
        return await runInTransaction(async (transactionalEntityManager) => {
            const order = await transactionalEntityManager.findOne(PurchaseOrder, {
                where: branchId ? ({ id: orderId, branch_id: branchId } as any) : ({ id: orderId } as any)
            });
            if (!order) throw new Error("Order not found");
            if (order.status !== PurchaseOrderStatus.PENDING) {
                throw new Error("Only pending orders can be updated");
            }

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
            return this.findByIdInternal(orderId, transactionalEntityManager, branchId);
        });
    }

    async findById(id: string, branchId?: string): Promise<PurchaseOrder | null> {
        return await getRepository(PurchaseOrder).findOne({
            where: branchId ? ({ id, branch_id: branchId } as any) : ({ id } as any),
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

    async updateStatus(id: string, status: PurchaseOrderStatus, branchId?: string): Promise<PurchaseOrder | null> {
        const ordersRepository = getRepository(PurchaseOrder);
        const order = await ordersRepository.findOneBy(branchId ? ({ id, branch_id: branchId } as any) : ({ id } as any));
        if (!order) return null;

        order.status = status;
        return await ordersRepository.save(order);
    }

    async delete(id: string, branchId?: string): Promise<boolean> {
        const result = await getRepository(PurchaseOrder).delete(branchId ? ({ id, branch_id: branchId } as any) : ({ id } as any));
        return result.affected !== 0;
    }

    async confirmPurchase(orderId: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string, branchId?: string): Promise<PurchaseOrder> {
        return await runInTransaction(async (transactionalEntityManager) => {
            const order = await transactionalEntityManager.findOne(PurchaseOrder, {
                where: branchId ? ({ id: orderId, branch_id: branchId } as any) : ({ id: orderId } as any),
                // Serialize purchase confirmation per order to avoid duplicate detail inserts.
                lock: { mode: "pessimistic_write" }
            });

            if (!order) {
                throw new Error("Order not found");
            }

            if (order.status !== PurchaseOrderStatus.PENDING) {
                throw new Error("Only pending orders can be confirmed");
            }

            // 1. Fetch Order Items
            const orderItems = await transactionalEntityManager.find(StockOrdersItem, {
                where: { orders_id: orderId },
                relations: { ordersDetail: true }
            });

            if (!orderItems.length) {
                throw new Error("Order has no items");
            }

            const payloadByIngredient = new Map<string, { actual_quantity: number; is_purchased: boolean }>();
            for (const item of items) {
                if (payloadByIngredient.has(item.ingredient_id)) {
                    throw new Error(`Duplicate ingredient in payload: ${item.ingredient_id}`);
                }
                payloadByIngredient.set(item.ingredient_id, {
                    actual_quantity: item.actual_quantity,
                    is_purchased: Boolean(item.is_purchased),
                });
            }

            const validIngredientIds = new Set(orderItems.map((item) => item.ingredient_id));
            for (const ingredientId of payloadByIngredient.keys()) {
                if (!validIngredientIds.has(ingredientId)) {
                    throw new Error(`Ingredient is not part of this order: ${ingredientId}`);
                }
            }

            const effectiveBranchId = branchId || (order as any).branch_id;
            if (!effectiveBranchId) {
                throw new Error("Order branch_id is missing");
            }

            // Aggregate quantities to add to stock per ingredient (only purchased items).
            const stockAdditions = new Map<string, number>();

            // 2. Update/Create OrdersDetail for every order item
            for (const item of items) {
                const orderItem = orderItems.find((oi) => oi.ingredient_id === item.ingredient_id);
                if (!orderItem) continue;

                let detail = orderItem.ordersDetail;
                if (!detail) {
                    detail = transactionalEntityManager.create(StockOrdersDetail, {
                        orders_item_id: orderItem.id
                    });
                }

                const payload = payloadByIngredient.get(orderItem.ingredient_id);
                const isPurchased = Boolean(payload?.is_purchased);
                const normalizedActualQty = isPurchased
                    ? Math.max(0, Number(payload?.actual_quantity ?? 0))
                    : 0;

                detail.actual_quantity = normalizedActualQty;
                detail.is_purchased = isPurchased;
                detail.purchased_by_id = purchasedById;

                await transactionalEntityManager.save(StockOrdersDetail, detail);

                if (isPurchased && normalizedActualQty > 0) {
                    stockAdditions.set(
                        orderItem.ingredient_id,
                        (stockAdditions.get(orderItem.ingredient_id) || 0) + normalizedActualQty
                    );
                }
            }

            for (const orderItem of orderItems) {
                if (payloadByIngredient.has(orderItem.ingredient_id)) {
                    continue;
                }

                let detail = orderItem.ordersDetail;
                if (!detail) {
                    detail = transactionalEntityManager.create(StockOrdersDetail, {
                        orders_item_id: orderItem.id
                    });
                }

                detail.actual_quantity = 0;
                detail.is_purchased = false;
                detail.purchased_by_id = purchasedById;

                await transactionalEntityManager.save(StockOrdersDetail, detail);
            }

            // 3. Apply stock additions to branch_stock (upsert + increment).
            // This is done inside the same transaction as purchase confirmation, guarded by the order lock above.
            for (const [ingredientId, qtyToAdd] of stockAdditions.entries()) {
                await transactionalEntityManager.query(
                    `
                    INSERT INTO "branch_stock" ("id", "branch_id", "ingredient_id", "quantity")
                    VALUES (uuid_generate_v4(), $1, $2, $3)
                    ON CONFLICT ("branch_id", "ingredient_id")
                    DO UPDATE SET
                      "quantity" = "branch_stock"."quantity" + EXCLUDED."quantity",
                      "last_updated" = CURRENT_TIMESTAMP
                    `,
                    [effectiveBranchId, ingredientId, qtyToAdd]
                );
            }

            // 3. Update Order Status to COMPLETED
            await transactionalEntityManager.update(PurchaseOrder, branchId ? ({ id: orderId, branch_id: branchId } as any) : ({ id: orderId } as any), { status: PurchaseOrderStatus.COMPLETED });

            // 4. Return updated order
            return this.findByIdInternal(orderId, transactionalEntityManager, branchId);
        });
    }

    // internal helper for transaction
    private async findByIdInternal(id: string, manager: any, branchId?: string): Promise<PurchaseOrder> {
        return await manager.findOne(PurchaseOrder, {
            where: branchId ? ({ id, branch_id: branchId } as any) : ({ id } as any),
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
