import { DeliveryModels } from "../../models/pos/delivery.model";
import { SocketService } from "../socket.service";
import { Delivery } from "../../entity/pos/Delivery";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { getDbContext, getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import { OrderSummarySnapshotService } from "./orderSummarySnapshot.service";
import { bumpOrderReadModelVersions, invalidateOrderReadCaches } from "./ordersReadCache.utils";

export class DeliveryService {
    private socketService = SocketService.getInstance();
    private orderSummarySnapshotService = new OrderSummarySnapshotService();
    private readonly CACHE_PREFIX = "delivery";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private deliveryModel: DeliveryModels) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private getInvalidationPatterns(branchId?: string, id?: string): string[] {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;

        if (!effectiveBranchId) {
            return [`${this.CACHE_PREFIX}:`];
        }

        const scopes: Array<Array<string>> = [
            ["branch", effectiveBranchId],
            ["admin"],
            ["public"],
        ];
        const patterns: string[] = [];

        for (const scope of scopes) {
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "name"));
            if (id) {
                patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single", id));
            }
        }

        return patterns;
    }

    private invalidateDeliveryCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    private async invalidateOrderReadModels(branchId?: string): Promise<void> {
        await bumpOrderReadModelVersions(branchId);
        invalidateOrderReadCaches(branchId);
    }

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old",
        status?: "active" | "inactive"
    ): Promise<{ data: Delivery[]; total: number; page: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            sortCreated,
            (q || "").trim().toLowerCase(),
            status || "all"
        );

        return withCache(
            key,
            () => this.deliveryModel.findAll(page, limit, q, branchId, sortCreated, status),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Delivery | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.deliveryModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(delivery_name: string, branchId?: string): Promise<Delivery | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = delivery_name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.deliveryModel.findOneByName(delivery_name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(delivery: Delivery): Promise<Delivery> {
        const deliveryName = delivery.delivery_name?.trim();
        if (!deliveryName) {
            throw AppError.badRequest("Delivery name is required");
        }

        delivery.delivery_name = deliveryName;
        if (delivery.delivery_prefix) {
            delivery.delivery_prefix = delivery.delivery_prefix.trim().toUpperCase();
        }
        if (!delivery.delivery_prefix?.trim()) {
            delivery.delivery_prefix = null as string | null;
        }

        const existingDelivery = await this.deliveryModel.findOneByName(delivery.delivery_name, delivery.branch_id);
        if (existingDelivery) {
            throw AppError.conflict("Delivery name already exists");
        }

        const createdDelivery = await this.deliveryModel.create(delivery);
        this.invalidateDeliveryCache(createdDelivery.branch_id, createdDelivery.id);
        if (createdDelivery.branch_id) {
            this.socketService.emitToBranch(createdDelivery.branch_id, RealtimeEvents.delivery.create, createdDelivery);
        }
        return createdDelivery;
    }

    async update(id: string, delivery: Delivery, branchId?: string): Promise<Delivery> {
        const deliveryToUpdate = await this.deliveryModel.findOne(id, branchId);
        if (!deliveryToUpdate) {
            throw AppError.notFound("Delivery");
        }

        if (delivery.delivery_name !== undefined) {
            delivery.delivery_name = delivery.delivery_name.trim();
            if (!delivery.delivery_name) {
                throw AppError.badRequest("Delivery name is required");
            }
        }

        if (delivery.delivery_prefix !== undefined) {
            const normalizedPrefix = delivery.delivery_prefix?.trim().toUpperCase();
            delivery.delivery_prefix = (normalizedPrefix || null) as string | null;
        }

        const normalizedIncomingName = delivery.delivery_name?.trim().toLowerCase();
        const normalizedCurrentName = deliveryToUpdate.delivery_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const existingDelivery = await this.deliveryModel.findOneByName(
                delivery.delivery_name,
                delivery.branch_id || deliveryToUpdate.branch_id
            );
            if (existingDelivery && existingDelivery.id !== id) {
                throw AppError.conflict("Delivery name already exists");
            }
        }

        const effectiveBranchId = deliveryToUpdate.branch_id || branchId || delivery.branch_id;
        const updatedDelivery = await this.deliveryModel.update(id, delivery, effectiveBranchId);
        await this.orderSummarySnapshotService.syncDeliveryMetadata(id);
        await this.invalidateOrderReadModels(effectiveBranchId);
        this.invalidateDeliveryCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.delivery.update, updatedDelivery);
        }
        return updatedDelivery;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.deliveryModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Delivery");
        }

        const effectiveBranchId = existing.branch_id || branchId;
        const orderCount = await getRepository(SalesOrder).count({
            where: effectiveBranchId
                ? ({ delivery_id: id, branch_id: effectiveBranchId } as any)
                : ({ delivery_id: id } as any),
        });
        if (orderCount > 0) {
            throw AppError.conflict("Delivery provider cannot be deleted because it is referenced by orders");
        }

        await this.deliveryModel.delete(id, branchId);
        this.invalidateDeliveryCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.delivery.delete, { id });
        }
    }
}
