import { EntityManager } from "typeorm";
import { getRepository, runInTransaction, runWithDbContext } from "../../database/dbContext";
import { Category } from "../../entity/pos/Category";
import { OrderStatus, OrderType } from "../../entity/pos/OrderEnums";
import { Products } from "../../entity/pos/Products";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { ShopProfile } from "../../entity/pos/ShopProfile";
import { OrdersModels } from "../../models/pos/orders.model";
import { AppError } from "../../utils/AppError";
import { OrdersService } from "../pos/orders.service";
import { ShiftsService } from "../pos/shifts.service";

type PublicOrderItemInput = {
    product_id: string;
    quantity: number;
    notes?: string;
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

    private assertNoCustomerModifiers(items: unknown[]): void {
        const hasDetails = items.some(
            (item) =>
                item &&
                typeof item === "object" &&
                Object.prototype.hasOwnProperty.call(item as Record<string, unknown>, "details"),
        );

        if (hasDetails) {
            throw new AppError("QR ordering supports notes only. Modifiers are not allowed.", 400);
        }
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
            });
        }

        return Array.from(categoryMap.values()).filter((category) => category.items.length > 0);
    }

    private toOrderItemsInput(items: PublicOrderItemInput[]) {
        return items.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            discount_amount: 0,
            notes: typeof item.notes === "string" ? item.notes.trim() : "",
            status: OrderStatus.Pending,
            details: [],
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

        this.assertNoCustomerModifiers(rawItems);

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
