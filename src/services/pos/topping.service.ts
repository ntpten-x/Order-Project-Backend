import { ToppingModels } from "../../models/pos/topping.model";
import { SocketService } from "../socket.service";
import { Topping } from "../../entity/pos/Topping";
import { Category } from "../../entity/pos/Category";
import { getDbContext, getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";

export class ToppingService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "topping";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private toppingModel: ToppingModels) { }

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

    private invalidateToppingCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    private normalizePrice(rawPrice: unknown, fallback?: number): number {
        if (rawPrice === undefined || rawPrice === null || rawPrice === "") {
            return fallback ?? 0;
        }

        const numericPrice = Number(rawPrice);
        if (!Number.isFinite(numericPrice) || numericPrice < 0) {
            throw AppError.badRequest("Topping price must be a non-negative number");
        }

        return numericPrice;
    }

    private async resolveCategories(categoryIds: string[] | undefined, branchId?: string): Promise<Category[]> {
        const normalizedIds = Array.from(
            new Set((categoryIds || []).map((id) => id?.trim()).filter((id): id is string => Boolean(id)))
        );

        if (normalizedIds.length === 0) {
            throw AppError.badRequest("At least one topping category is required");
        }

        const categoryRepository = getRepository(Category);
        const query = categoryRepository
            .createQueryBuilder("category")
            .where("category.id IN (:...ids)", { ids: normalizedIds });

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        const categories = await query.getMany();
        if (categories.length !== normalizedIds.length) {
            throw AppError.badRequest("One or more topping categories are invalid for this branch");
        }

        return categories.sort(
            (a, b) => normalizedIds.indexOf(a.id) - normalizedIds.indexOf(b.id)
        );
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<Topping[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list-all", sortCreated);

        return withCache(
            key,
            () => this.toppingModel.findAll(branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive"; category_id?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Topping[]; total: number; page: number; limit: number; last_page: number }> {
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
            filters?.category_id || "all"
        );

        return withCache(
            key,
            () => this.toppingModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Topping | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.toppingModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<Topping | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.toppingModel.findOneByName(name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(topping: Partial<Topping> & { category_ids?: string[] }, branchId?: string): Promise<Topping> {
        const effectiveBranchId = branchId || topping.branch_id;
        const displayName = topping.display_name?.trim();

        if (!displayName) {
            throw AppError.badRequest("Topping name is required");
        }

        topping.display_name = displayName;
        topping.price = this.normalizePrice(topping.price);
        if (effectiveBranchId) {
            topping.branch_id = effectiveBranchId;
        }

        const existingTopping = await this.toppingModel.findOneByName(displayName, effectiveBranchId);
        if (existingTopping) {
            throw AppError.conflict("Topping name already exists");
        }

        const categories = await this.resolveCategories(topping.category_ids, effectiveBranchId);
        const payload = { ...(topping as Partial<Topping> & { category_ids?: string[] }) };
        delete (payload as { category_ids?: string[] }).category_ids;
        const createdTopping = await this.toppingModel.create({
            ...payload,
            categories,
        });
        this.invalidateToppingCache(effectiveBranchId, createdTopping.id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.topping.create, createdTopping);
        }
        return createdTopping;
    }

    async update(id: string, topping: Partial<Topping> & { category_ids?: string[] }, branchId?: string): Promise<Topping> {
        const effectiveBranchId = branchId || topping.branch_id;
        const existingTopping = await this.toppingModel.findOne(id, effectiveBranchId);
        if (!existingTopping) {
            throw AppError.notFound("Topping");
        }
        const scopedBranchId = effectiveBranchId || existingTopping.branch_id;

        if (topping.display_name !== undefined) {
            topping.display_name = topping.display_name.trim();
            if (!topping.display_name) {
                throw AppError.badRequest("Topping name is required");
            }
        }

        const normalizedIncomingName = topping.display_name?.trim().toLowerCase();
        const normalizedCurrentName = existingTopping.display_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const foundTopping = await this.toppingModel.findOneByName(topping.display_name!, scopedBranchId);
            if (foundTopping && foundTopping.id !== id) {
                throw AppError.conflict("Topping name already exists");
            }
        }

        if (scopedBranchId) {
            topping.branch_id = scopedBranchId;
        }

        const payload = { ...(topping as Partial<Topping> & { category_ids?: string[] }) };
        delete (payload as { category_ids?: string[] }).category_ids;
        const nextPayload: Partial<Topping> = { ...payload };
        if (topping.price !== undefined) {
            nextPayload.price = this.normalizePrice(topping.price, Number(existingTopping.price || 0));
        }
        if (topping.category_ids !== undefined) {
            nextPayload.categories = await this.resolveCategories(topping.category_ids, scopedBranchId);
        }

        const updatedTopping = await this.toppingModel.update(id, nextPayload, scopedBranchId);
        this.invalidateToppingCache(scopedBranchId, id);
        if (scopedBranchId) {
            this.socketService.emitToBranch(scopedBranchId, RealtimeEvents.topping.update, updatedTopping);
        }
        return updatedTopping;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.toppingModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Topping");
        }

        const effectiveBranchId = branchId || existing.branch_id;
        await this.toppingModel.delete(id, effectiveBranchId);
        this.invalidateToppingCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.topping.delete, { id });
        }
    }
}
