import { DiscountsModels } from "../../models/pos/discounts.model";
import { SocketService } from "../socket.service";
import { Discounts } from "../../entity/pos/Discounts";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import { getDbContext, getRepository } from "../../database/dbContext";
import { SalesOrder } from "../../entity/pos/SalesOrder";

export class DiscountsService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "discounts";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private discountsModel: DiscountsModels) { }

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

    private invalidateDiscountCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    private normalizeMutableFields(discount: Partial<Discounts>): Partial<Discounts> {
        const next = { ...discount };

        if (next.display_name !== undefined) {
            const value = next.display_name.trim();
            if (!value) {
                throw AppError.badRequest("Discount name is required");
            }
            next.display_name = value;
        }

        if (next.description !== undefined) {
            next.description = next.description.trim() || undefined;
        }

        return next;
    }

    async findAll(q?: string, branchId?: string, sortCreated: CreatedSort = "old"): Promise<Discounts[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list-all", sortCreated, (q || "").trim().toLowerCase());

        return withCache(
            key,
            () => this.discountsModel.findAll(q, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive"; type?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Discounts[]; total: number; page: number; limit: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            sortCreated,
            (filters?.q || "").trim().toLowerCase(),
            filters?.status || "all",
            (filters?.type || "").trim()
        );

        return withCache(
            key,
            () => this.discountsModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Discounts | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.discountsModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<Discounts | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.discountsModel.findOneByName(name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(discounts: Discounts, branchId?: string): Promise<Discounts> {
        const normalizedDiscount = this.normalizeMutableFields(discounts) as Discounts;
        const effectiveBranchId = branchId || normalizedDiscount.branch_id;
        if (effectiveBranchId) {
            normalizedDiscount.branch_id = effectiveBranchId;
        }
        if (!normalizedDiscount.display_name) {
            throw AppError.badRequest("Discount name is required");
        }

        const existingDiscount = await this.discountsModel.findOneByName(normalizedDiscount.display_name, effectiveBranchId);
        if (existingDiscount) {
            throw AppError.conflict("Discount name already exists");
        }

        const createdDiscount = await this.discountsModel.create(normalizedDiscount);
        this.invalidateDiscountCache(effectiveBranchId, createdDiscount.id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.create, createdDiscount);
        }
        return createdDiscount;
    }

    async update(id: string, discounts: Discounts, branchId?: string): Promise<Discounts> {
        const effectiveBranchId = branchId || discounts.branch_id;
        const discountToUpdate = await this.discountsModel.findOne(id, effectiveBranchId);
        if (!discountToUpdate) {
            throw AppError.notFound("Discount");
        }

        const normalizedDiscount = this.normalizeMutableFields(discounts) as Discounts;
        const resolvedBranchId = effectiveBranchId || discountToUpdate.branch_id;
        if (resolvedBranchId) {
            normalizedDiscount.branch_id = resolvedBranchId;
        }

        const normalizedIncomingName = normalizedDiscount.display_name?.trim().toLowerCase();
        const normalizedCurrentName = discountToUpdate.display_name?.trim().toLowerCase();
        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const existingDiscount = await this.discountsModel.findOneByName(normalizedDiscount.display_name!, resolvedBranchId);
            if (existingDiscount && existingDiscount.id !== id) {
                throw AppError.conflict("Discount name already exists");
            }
        }

        const updatedDiscount = await this.discountsModel.update(id, normalizedDiscount, resolvedBranchId);
        this.invalidateDiscountCache(resolvedBranchId, id);
        if (resolvedBranchId) {
            this.socketService.emitToBranch(resolvedBranchId, RealtimeEvents.discounts.update, updatedDiscount);
        }
        return updatedDiscount;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.discountsModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Discount");
        }

        const effectiveBranchId = branchId || existing.branch_id;
        const orderCount = await getRepository(SalesOrder).count({
            where: effectiveBranchId
                ? ({ discount_id: id, branch_id: effectiveBranchId } as any)
                : ({ discount_id: id } as any),
        });
        if (orderCount > 0) {
            throw AppError.conflict("Discount cannot be deleted because it is referenced by orders");
        }

        await this.discountsModel.delete(id, effectiveBranchId);
        this.invalidateDiscountCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.delete, { id });
        }
    }
}
