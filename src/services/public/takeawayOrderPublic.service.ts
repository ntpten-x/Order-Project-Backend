import { EntityManager } from "typeorm";
import { getRepository, runInTransaction, runWithDbContext } from "../../database/dbContext";
import { Category } from "../../entity/pos/Category";
import { OrderStatus, OrderType } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { ShopProfile } from "../../entity/pos/ShopProfile";
import { Topping } from "../../entity/pos/Topping";
import { OrdersModels } from "../../models/pos/orders.model";
import { AppError } from "../../utils/AppError";
import { OrdersService } from "../pos/orders.service";
import { ShiftsService } from "../pos/shifts.service";

type PublicOrderItemInput = {
    product_id: string;
    quantity: number;
    notes?: string;
    details?: Array<{
        topping_id: string;
    }>;
};

type SubmitTakeawayOrderInput = {
    items: PublicOrderItemInput[];
    customer_name?: string;
};

export class PublicTakeawayOrderService {
    private ordersService = new OrdersService(new OrdersModels());
    private shiftsService = new ShiftsService();

    private getSalesOrderRepository(manager?: EntityManager) {
        return manager ? manager.getRepository(SalesOrder) : getRepository(SalesOrder);
    }

    private async resolveProfileByToken(token: string): Promise<ShopProfile> {
        const profile = await runWithDbContext(
            {
                isAdmin: true,
                userId: "public-takeaway-order",
                role: "public",
            },
            async () =>
                getRepository(ShopProfile)
                    .createQueryBuilder("shopProfile")
                    .where("shopProfile.takeaway_qr_token = :token", { token })
                    .andWhere(
                        "(shopProfile.takeaway_qr_expires_at IS NULL OR shopProfile.takeaway_qr_expires_at > NOW())",
                    )
                    .getOne(),
        );

        if (!profile?.branch_id) {
            throw new AppError("Takeaway QR is invalid or expired", 404);
        }

        return profile;
    }

    private normalizeCustomerIdentity(input: Pick<SubmitTakeawayOrderInput, "customer_name">) {
        const customerName = input.customer_name?.trim() || "";

        if (!customerName) {
            throw new AppError("Please provide a customer name", 400);
        }

        return {
            customerName: customerName || undefined,
        };
    }

    private async assertProductsAvailableForPublicOrder(
        branchId: string,
        items: PublicOrderItemInput[],
        manager?: EntityManager,
    ): Promise<void> {
        const productIds = Array.from(
            new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
        );

        if (productIds.length === 0) {
            throw new AppError("Please add at least one item", 400);
        }

        const productRepo = manager ? manager.getRepository(Products) : getRepository(Products);
        const rows = await productRepo
            .createQueryBuilder("product")
            .leftJoin("product.category", "category")
            .select("product.id", "id")
            .where("product.branch_id = :branchId", { branchId })
            .andWhere("product.is_active = true")
            .andWhere("category.is_active = true")
            .andWhere("product.id IN (:...productIds)", { productIds })
            .getRawMany<{ id: string }>();

        if (rows.length !== productIds.length) {
            throw new AppError("Some items are unavailable. Please refresh menu and try again.", 409);
        }
    }

    private mapOrderItem(item: SalesOrderItem) {
        return {
            id: item.id,
            product_id: item.product_id,
            display_name: item.product?.display_name || "-",
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            total_price: Number(item.total_price || 0),
            status: item.status,
            notes: item.notes || "",
            details: Array.isArray(item.details)
                ? item.details.map((detail) => ({
                      id: detail.id,
                      detail_name: detail.detail_name,
                      extra_price: Number(detail.extra_price || 0),
                      topping_id: detail.topping_id ?? null,
                  }))
                : [],
        };
    }

    private canAddItemsToOrder(status: string | undefined | null): boolean {
        const normalized = String(status || "").trim().toLowerCase();
        return normalized === "pending" || normalized === "cooking" || normalized === "served";
    }

    private async ensurePublicOrderingAvailable(branchId: string): Promise<void> {
        const activeShift = await runWithDbContext(
            {
                branchId,
                userId: "public-takeaway-order",
                role: "public",
                isAdmin: false,
            },
            () => this.shiftsService.getCurrentShift(branchId),
        );
        if (!activeShift) {
            throw new AppError("Public ordering is unavailable while the shift is closed", 403);
        }
    }

    private mapOrder(order: SalesOrder | null) {
        if (!order) {
            return null;
        }

        return {
            id: order.id,
            order_no: order.order_no,
            status: order.status,
            order_type: order.order_type,
            customer_name: order.customer_name || null,
            total_amount: Number(order.total_amount || 0),
            sub_total: Number(order.sub_total || 0),
            discount_amount: Number(order.discount_amount || 0),
            vat: Number(order.vat || 0),
            create_date: order.create_date,
            update_date: order.update_date,
            can_add_items: this.canAddItemsToOrder(String(order.status || "")),
            items: Array.isArray(order.items) ? order.items.map((item) => this.mapOrderItem(item)) : [],
        };
    }

    private async loadMenu(branchId: string) {
        const categories = await getRepository(Category)
            .createQueryBuilder("category")
            .where("category.branch_id = :branchId", { branchId })
            .andWhere("category.is_active = true")
            .orderBy("category.display_name", "ASC")
            .getMany();

        const products = await getRepository(Products)
            .createQueryBuilder("product")
            .leftJoinAndSelect("product.category", "category")
            .leftJoinAndSelect("product.unit", "unit")
            .leftJoinAndSelect("product.topping_groups", "topping_group")
            .where("product.branch_id = :branchId", { branchId })
            .andWhere("product.is_active = true")
            .andWhere("category.is_active = true")
            .orderBy("category.display_name", "ASC")
            .addOrderBy("product.display_name", "ASC")
            .getMany();

        const categoryMap = new Map(
            categories.map((category) => [
                category.id,
                {
                    id: category.id,
                    display_name: category.display_name,
                    items: [] as Array<{
                        id: string;
                        category_id: string;
                        display_name: string;
                        description: string;
                        price: number;
                        img_url: string | null;
                        unit_display_name: string | null;
                        topping_group_ids: string[];
                    }>,
                },
            ]),
        );

        for (const product of products) {
            if (!categoryMap.has(product.category_id)) {
                categoryMap.set(product.category_id, {
                    id: product.category_id,
                    display_name: product.category?.display_name || "Uncategorized",
                    items: [],
                });
            }

            const category = categoryMap.get(product.category_id)!;
            category.items.push({
                id: product.id,
                category_id: product.category_id,
                display_name: product.display_name,
                description: product.description || "",
                price: Number(product.price || 0),
                img_url: product.img_url || null,
                unit_display_name: product.unit?.display_name || null,
                topping_group_ids: (product.topping_groups || []).map((toppingGroup) => toppingGroup.id),
            });
        }

        return Array.from(categoryMap.values()).filter((category) => category.items.length > 0);
    }

    private async loadToppings(branchId: string) {
        const toppings = await getRepository(Topping)
            .createQueryBuilder("topping")
            .leftJoinAndSelect("topping.categories", "category")
            .leftJoinAndSelect("topping.topping_groups", "topping_group")
            .where("topping.branch_id = :branchId", { branchId })
            .andWhere("topping.is_active = true")
            .andWhere("(category.id IS NULL OR category.is_active = true)")
            .orderBy("topping.display_name", "ASC")
            .addOrderBy("category.display_name", "ASC")
            .getMany();

        return toppings.map((topping) => ({
            id: topping.id,
            display_name: topping.display_name,
            price: Number(topping.price || 0),
            price_delivery: Number(topping.price_delivery ?? topping.price ?? 0),
            img: topping.img || null,
            create_date: topping.create_date,
            update_date: topping.update_date,
            is_active: Boolean(topping.is_active),
            categories: Array.isArray(topping.categories)
                ? topping.categories
                    .filter((category) => category.is_active)
                    .map((category) => ({
                        id: category.id,
                        display_name: category.display_name,
                        create_date: category.create_date,
                        update_date: category.update_date,
                        is_active: Boolean(category.is_active),
                    }))
                : [],
            topping_groups: Array.isArray(topping.topping_groups)
                ? topping.topping_groups
                    .filter((toppingGroup) => toppingGroup.is_active)
                    .map((toppingGroup) => ({
                        id: toppingGroup.id,
                        display_name: toppingGroup.display_name,
                        create_date: toppingGroup.create_date,
                        update_date: toppingGroup.update_date,
                        is_active: Boolean(toppingGroup.is_active),
                    }))
                : [],
        }));
    }

    private toOrderItemsInput(items: PublicOrderItemInput[]) {
        return items.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            discount_amount: 0,
            notes: typeof item.notes === "string" ? item.notes.trim() : "",
            status: OrderStatus.Pending,
            details: Array.isArray(item.details)
                ? item.details.map((detail) => ({
                    topping_id: String(detail.topping_id || "").trim(),
                }))
                : [],
        }));
    }

    async getBootstrapByToken(token: string) {
        const profile = await this.resolveProfileByToken(token);
        return runWithDbContext(
            {
                branchId: profile.branch_id,
                userId: "public-takeaway-order",
                role: "public",
                isAdmin: false,
            },
            async () => ({
                channel: {
                    kind: "takeaway",
                    shop_name: profile.shop_name || "POS Shop",
                },
                menu: await this.loadMenu(profile.branch_id!),
                toppings: await this.loadToppings(profile.branch_id!),
                policy: {
                    requires_customer_identity: true,
                    can_customer_cancel: false,
                    can_customer_pay: false,
                    refund_supported: false,
                },
            }),
        );
    }

    async submitByToken(token: string, payload: SubmitTakeawayOrderInput) {
        const profile = await this.resolveProfileByToken(token);
        const branchId = profile.branch_id!;
        await this.ensurePublicOrderingAvailable(branchId);
        const rawItems = Array.isArray((payload as { items?: unknown[] })?.items)
            ? ((payload as { items: unknown[] }).items ?? [])
            : [];

        if (rawItems.length === 0) {
            throw new AppError("Please add at least one item", 400);
        }

        const normalizedItems = this.toOrderItemsInput(payload.items || []);
        const { customerName } = this.normalizeCustomerIdentity(payload);

        return runWithDbContext(
            {
                branchId,
                userId: "public-takeaway-order",
                role: "public",
                isAdmin: false,
            },
            async () => {
                const created = await runInTransaction(async (manager) => {
                    await this.assertProductsAvailableForPublicOrder(branchId, normalizedItems, manager);
                    return this.ordersService.createFullOrder(
                        {
                            order_type: OrderType.TakeAway,
                            status: OrderStatus.Pending,
                            sub_total: 0,
                            discount_amount: 0,
                            vat: 0,
                            total_amount: 0,
                            received_amount: 0,
                            change_amount: 0,
                            customer_name: customerName || null,
                            items: normalizedItems,
                        },
                        branchId,
                    );
                });

                const refreshed = await this.ordersService.findOne(created.id, branchId);
                return {
                    mode: "create" as const,
                    channel: {
                        kind: "takeaway" as const,
                        shop_name: profile.shop_name || "POS Shop",
                    },
                    order: this.mapOrder(refreshed || created),
                };
            },
        );
    }

    async resolveOrderByToken(token: string, orderId: string) {
        const profile = await this.resolveProfileByToken(token);

        return runWithDbContext(
            {
                branchId: profile.branch_id,
                userId: "public-takeaway-order",
                role: "public",
                isAdmin: false,
            },
            async () => {
                const order = await this.getSalesOrderRepository()
                    .createQueryBuilder("order")
                    .leftJoinAndSelect("order.items", "items")
                    .leftJoinAndSelect("items.product", "product")
                    .leftJoinAndSelect("items.details", "details")
                    .where("order.id = :orderId", { orderId })
                    .andWhere("order.branch_id = :branchId", { branchId: profile.branch_id })
                    .andWhere("order.order_type = :orderType", { orderType: OrderType.TakeAway })
                    .orderBy("order.create_date", "DESC")
                    .getOne();

                if (!order) {
                    throw new AppError("Order not found for this takeaway QR", 404);
                }

                return {
                    channel: {
                        kind: "takeaway",
                        shop_name: profile.shop_name || "POS Shop",
                    },
                    order: this.mapOrder(order),
                };
            },
        );
    }
}
