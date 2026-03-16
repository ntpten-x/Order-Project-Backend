import { Brackets, SelectQueryBuilder } from "typeorm";
import { PurchaseOrder, PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersItem } from "../../entity/stock/OrdersItem";
import { StockOrdersDetail } from "../../entity/stock/OrdersDetail";
import { Ingredients } from "../../entity/stock/Ingredients";
import { getRepository, runInTransaction } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class StockOrdersModel {
    private normalizeOrderItems(
        items: Array<{ ingredient_id: string; quantity_ordered: number }>
    ): Array<{ ingredient_id: string; quantity_ordered: number }> {
        const merged = new Map<string, number>();

        for (const item of items) {
            const ingredientId = String(item.ingredient_id || "").trim();
            const quantity = Math.trunc(Number(item.quantity_ordered || 0));
            if (!ingredientId) {
                throw new Error("Ingredient is required");
            }
            if (!Number.isFinite(quantity) || quantity <= 0) {
                throw new Error(`Invalid quantity for ingredient ${ingredientId}`);
            }
            merged.set(ingredientId, (merged.get(ingredientId) || 0) + quantity);
        }

        return Array.from(merged.entries()).map(([ingredient_id, quantity_ordered]) => ({
            ingredient_id,
            quantity_ordered,
        }));
    }

    private normalizePurchaseItems(
        items: Array<{ ingredient_id: string; actual_quantity: number; is_purchased: boolean }>
    ): Array<{ ingredient_id: string; actual_quantity: number; is_purchased: boolean }> {
        const merged = new Map<string, { actual_quantity: number; is_purchased: boolean }>();

        for (const item of items) {
            const ingredientId = String(item.ingredient_id || "").trim();
            const actualQuantity = Math.max(0, Math.trunc(Number(item.actual_quantity || 0)));
            if (!ingredientId) {
                throw new Error("Ingredient is required");
            }

            const previous = merged.get(ingredientId);
            merged.set(ingredientId, {
                actual_quantity: previous ? previous.actual_quantity + actualQuantity : actualQuantity,
                is_purchased: Boolean(item.is_purchased) || Boolean(previous?.is_purchased),
            });
        }

        return Array.from(merged.entries()).map(([ingredient_id, value]) => ({
            ingredient_id,
            actual_quantity: value.is_purchased ? value.actual_quantity : 0,
            is_purchased: value.is_purchased,
        }));
    }

    private async assertIngredientsInBranch(
        manager: any,
        ingredientIds: string[],
        branchId?: string,
        allowedInactiveIds: Set<string> = new Set()
    ): Promise<void> {
        const uniqueIds = Array.from(new Set(ingredientIds.filter(Boolean)));
        if (uniqueIds.length === 0) {
            throw new Error("Order requires at least one ingredient");
        }

        const ingredientsRepository = manager.getRepository(Ingredients);
        const query = ingredientsRepository
            .createQueryBuilder("ingredient")
            .select("ingredient.id", "id")
            .where("ingredient.id IN (:...ingredientIds)", { ingredientIds: uniqueIds });

        if (branchId) {
            query.andWhere("ingredient.branch_id = :branchId", { branchId });
        }

        const rows = await query
            .addSelect("ingredient.is_active", "is_active")
            .getRawMany() as Array<{ id: string; is_active: boolean }>;
        if (rows.length !== uniqueIds.length) {
            throw new Error("Some ingredients are unavailable for this branch");
        }

        const hasDisallowedInactiveIngredient = rows.some(
            (row) => !Boolean(row.is_active) && !allowedInactiveIds.has(row.id)
        );
        if (hasDisallowedInactiveIngredient) {
            throw new Error("Some ingredients are inactive for this branch");
        }
    }

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

    private sanitizeOrder(order: PurchaseOrder | null): PurchaseOrder | null {
        if (!order) return order;

        if ("ordered_by" in order) {
            (order as any).ordered_by = this.sanitizeUser((order as any).ordered_by);
        }

        if (Array.isArray(order.ordersItems)) {
            order.ordersItems = order.ordersItems.map((item) => {
                if (item?.ordersDetail && typeof item.ordersDetail === "object" && "purchased_by" in item.ordersDetail) {
                    (item.ordersDetail as any).purchased_by = this.sanitizeUser((item.ordersDetail as any).purchased_by);
                }
                return item;
            });
        }

        return order;
    }

    private sanitizeOrders(orders: PurchaseOrder[]): PurchaseOrder[] {
        return orders.map((order) => this.sanitizeOrder(order) as PurchaseOrder);
    }

    private applyListFilters(
        query: SelectQueryBuilder<PurchaseOrder>,
        filters?: { status?: PurchaseOrderStatus | PurchaseOrderStatus[]; q?: string },
        branchId?: string
    ) {
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

        const rawQuery = filters?.q?.trim();
        if (!rawQuery) {
            return query;
        }

        const normalizedQuery = `%${rawQuery.replace(/\s+/g, "%")}%`;
        query
            .leftJoin("order.ordered_by", "ordered_by")
            .leftJoin("order.ordersItems", "ordersItems")
            .leftJoin("ordersItems.ingredient", "ingredient")
            .andWhere(
                new Brackets((builder) => {
                    builder
                        .where("CAST(order.id AS text) ILIKE :q", { q: normalizedQuery })
                        .orWhere("COALESCE(order.remark, '') ILIKE :q", { q: normalizedQuery })
                        .orWhere("COALESCE(ordered_by.name, '') ILIKE :q", { q: normalizedQuery })
                        .orWhere("COALESCE(ordered_by.username, '') ILIKE :q", { q: normalizedQuery })
                        .orWhere("COALESCE(ingredient.display_name, '') ILIKE :q", { q: normalizedQuery });
                })
            );

        return query;
    }

    // Creates an order and its items in a transaction
    async createOrderWithItems(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string, branchId?: string): Promise<PurchaseOrder> {
        return runInTransaction(async (manager) => {
            const normalizedItems = this.normalizeOrderItems(items);
            await this.assertIngredientsInBranch(
                manager,
                normalizedItems.map((item) => item.ingredient_id),
                branchId
            );

            const newOrder = manager.create(PurchaseOrder, {
                ordered_by_id: orderedById,
                status: PurchaseOrderStatus.PENDING,
                remark,
                branch_id: branchId,
            });

            const savedOrder = await manager.save(newOrder);

            const orderItems = normalizedItems.map((item) =>
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
        filters?: { status?: PurchaseOrderStatus | PurchaseOrderStatus[]; q?: string },
        page: number = 1,
        limit: number = 50,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: PurchaseOrder[], total: number, page: number, limit: number }> {
        const ordersRepository = getRepository(PurchaseOrder);
        const skip = (page - 1) * limit;
        const sortOrder = createdSortToOrder(sortCreated);

        const idsQuery = this.applyListFilters(
            ordersRepository.createQueryBuilder("order"),
            filters,
            branchId
        )
            .select("order.id", "id")
            .addSelect("order.create_date", "create_date")
            .distinct(true)
            .orderBy("order.create_date", sortOrder)
            .addOrderBy("order.id", sortOrder)
            .skip(skip)
            .take(limit);

        const total = await this.applyListFilters(
            ordersRepository.createQueryBuilder("order"),
            filters,
            branchId
        )
            .select("order.id")
            .distinct(true)
            .getCount();

        const rawIds = await idsQuery.getRawMany<{ id: string }>();
        const ids = rawIds.map((row) => row.id).filter(Boolean);

        if (ids.length === 0) {
            return {
                data: [],
                total,
                page,
                limit
            };
        }

        const data = await ordersRepository.createQueryBuilder("order")
            .leftJoinAndSelect("order.ordered_by", "ordered_by")
            .leftJoinAndSelect("order.ordersItems", "ordersItems")
            .leftJoinAndSelect("ordersItems.ingredient", "ingredient")
            .leftJoinAndSelect("ingredient.unit", "unit")
            .leftJoinAndSelect("ordersItems.ordersDetail", "ordersDetail")
            .where("order.id IN (:...ids)", { ids })
            .orderBy("order.create_date", sortOrder)
            .addOrderBy("ordersItems.id", "ASC")
            .getMany();

        const orderIndex = new Map(ids.map((id, index) => [id, index]));
        data.sort((left, right) => (orderIndex.get(left.id) ?? 0) - (orderIndex.get(right.id) ?? 0));

        return {
            data: this.sanitizeOrders(data),
            total,
            page,
            limit
        };
    }

    async updateOrderItems(orderId: string, newItems: { ingredient_id: string; quantity_ordered: number }[], branchId?: string): Promise<PurchaseOrder> {
        return await runInTransaction(async (transactionalEntityManager) => {
            const normalizedItems = this.normalizeOrderItems(newItems);
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
            const existingIngredientIds = new Set(existingItems.map((item) => item.ingredient_id));

            await this.assertIngredientsInBranch(
                transactionalEntityManager,
                normalizedItems.map((item) => item.ingredient_id),
                branchId || order.branch_id,
                existingIngredientIds
            );

            // 2. Identify items to delete (in DB but not in newItems)
            const newItemIds = normalizedItems.map(i => i.ingredient_id);
            const itemsToDelete = existingItems.filter(item => !newItemIds.includes(item.ingredient_id));

            if (itemsToDelete.length > 0) {
                await transactionalEntityManager.remove(itemsToDelete);
            }

            // 3. Identify items to update or create
            for (const newItem of normalizedItems) {
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
        const order = await getRepository(PurchaseOrder).findOne({
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
        return this.sanitizeOrder(order);
    }

    async updateStatus(id: string, status: PurchaseOrderStatus, branchId?: string): Promise<PurchaseOrder | null> {
        const ordersRepository = getRepository(PurchaseOrder);
        const order = await ordersRepository.findOneBy(branchId ? ({ id, branch_id: branchId } as any) : ({ id } as any));
        if (!order) return null;

        if (order.status !== PurchaseOrderStatus.PENDING && order.status !== status) {
            throw new Error("Only pending orders can change status");
        }

        order.status = status;
        await ordersRepository.save(order);
        return await this.findById(id, branchId);
    }

    async delete(id: string, branchId?: string): Promise<boolean> {
        const result = await getRepository(PurchaseOrder).delete(branchId ? ({ id, branch_id: branchId } as any) : ({ id } as any));
        return result.affected !== 0;
    }

    async confirmPurchase(orderId: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string, branchId?: string): Promise<PurchaseOrder> {
        return await runInTransaction(async (transactionalEntityManager) => {
            const normalizedItems = this.normalizePurchaseItems(items);
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
            for (const item of normalizedItems) {
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

            // 2. Update/Create OrdersDetail for every order item
            for (const item of normalizedItems) {
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

            // 3. Update Order Status to COMPLETED
            await transactionalEntityManager.update(PurchaseOrder, branchId ? ({ id: orderId, branch_id: branchId } as any) : ({ id: orderId } as any), { status: PurchaseOrderStatus.COMPLETED });

            // 4. Return updated order
            return this.findByIdInternal(orderId, transactionalEntityManager, branchId);
        });
    }

    // internal helper for transaction
    private async findByIdInternal(id: string, manager: any, branchId?: string): Promise<PurchaseOrder> {
        const order = await manager.findOne(PurchaseOrder, {
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
        return this.sanitizeOrder(order) as PurchaseOrder;
    }
}
