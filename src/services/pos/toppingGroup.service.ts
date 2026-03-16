import { ToppingGroupModels } from "../../models/pos/toppingGroup.model";
import { SocketService } from "../socket.service";
import { ToppingGroup } from "../../entity/pos/ToppingGroup";
import { Products } from "../../entity/pos/Products";
import { Topping } from "../../entity/pos/Topping";
import { getDbContext, getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";

export class ToppingGroupService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "topping-group";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private toppingGroupModel: ToppingGroupModels) {}

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
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list-all"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "name"));
            if (id) {
                patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single", id));
            }
        }

        return patterns;
    }

    private invalidateToppingGroupCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<ToppingGroup[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list-all", sortCreated);

        return withCache(
            key,
            () => this.toppingGroupModel.findAll(branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: ToppingGroup[]; total: number; page: number; limit: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            sortCreated,
            (filters?.q || "").trim().toLowerCase(),
            filters?.status || "all"
        );

        return withCache(
            key,
            () => this.toppingGroupModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<ToppingGroup | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.toppingGroupModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<ToppingGroup | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.toppingGroupModel.findOneByName(name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(toppingGroup: ToppingGroup): Promise<ToppingGroup> {
        const displayName = toppingGroup.display_name?.trim();

        if (!displayName) {
            throw AppError.badRequest("Topping group name is required");
        }

        toppingGroup.display_name = displayName;

        const existing = await this.toppingGroupModel.findOneByName(displayName, toppingGroup.branch_id);
        if (existing) {
            throw AppError.conflict("Topping group name already exists");
        }

        const createdToppingGroup = await this.toppingGroupModel.create(toppingGroup);
        this.invalidateToppingGroupCache(createdToppingGroup.branch_id, createdToppingGroup.id);
        if (createdToppingGroup.branch_id) {
            this.socketService.emitToBranch(createdToppingGroup.branch_id, RealtimeEvents.toppingGroups.create, createdToppingGroup);
        }
        return createdToppingGroup;
    }

    async update(id: string, toppingGroup: ToppingGroup, branchId?: string): Promise<ToppingGroup> {
        const toppingGroupToUpdate = await this.toppingGroupModel.findOne(id, branchId);
        if (!toppingGroupToUpdate) {
            throw AppError.notFound("Topping group");
        }

        if (toppingGroup.display_name !== undefined) {
            toppingGroup.display_name = toppingGroup.display_name.trim();
            if (!toppingGroup.display_name) {
                throw AppError.badRequest("Topping group name is required");
            }
        }

        const normalizedIncomingName = toppingGroup.display_name?.trim().toLowerCase();
        const normalizedCurrentName = toppingGroupToUpdate.display_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const existing = await this.toppingGroupModel.findOneByName(toppingGroup.display_name!, toppingGroupToUpdate.branch_id);
            if (existing && existing.id !== id) {
                throw AppError.conflict("Topping group name already exists");
            }
        }

        const effectiveBranchId = toppingGroupToUpdate.branch_id || branchId || toppingGroup.branch_id;
        const updatedToppingGroup = await this.toppingGroupModel.update(id, toppingGroup, effectiveBranchId);
        this.invalidateToppingGroupCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.toppingGroups.update, updatedToppingGroup);
        }
        return updatedToppingGroup;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.toppingGroupModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Topping group");
        }

        const effectiveBranchId = existing.branch_id || branchId;
        const productCount = await getRepository(Products)
            .createQueryBuilder("products")
            .innerJoin("products.topping_groups", "topping_group", "topping_group.id = :groupId", { groupId: id })
            .andWhere(effectiveBranchId ? "products.branch_id = :branchId" : "1=1", effectiveBranchId ? { branchId: effectiveBranchId } : {})
            .getCount();

        if (productCount > 0) {
            throw AppError.conflict("Topping group cannot be deleted because it is referenced by products");
        }

        const toppingCount = await getRepository(Topping)
            .createQueryBuilder("topping")
            .innerJoin("topping.topping_groups", "topping_group", "topping_group.id = :groupId", { groupId: id })
            .andWhere(effectiveBranchId ? "topping.branch_id = :branchId" : "1=1", effectiveBranchId ? { branchId: effectiveBranchId } : {})
            .getCount();

        if (toppingCount > 0) {
            throw AppError.conflict("Topping group cannot be deleted because it is referenced by toppings");
        }

        await this.toppingGroupModel.delete(id, branchId);
        this.invalidateToppingGroupCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.toppingGroups.delete, { id });
        }
    }
}
