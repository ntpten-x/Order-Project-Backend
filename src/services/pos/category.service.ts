import { CategoryModels } from "../../models/pos/category.model";
import { SocketService } from "../socket.service";
import { Category } from "../../entity/pos/Category";
import { Products } from "../../entity/pos/Products";
import { Topping } from "../../entity/pos/Topping";
import { getDbContext, getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";

export class CategoryService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "category";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private categoryModel: CategoryModels) { }

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

    private invalidateCategoryCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<Category[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list-all", sortCreated);

        return withCache(
            key,
            () => this.categoryModel.findAll(branchId, sortCreated),
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
    ): Promise<{ data: Category[]; total: number; page: number; limit: number; last_page: number }> {
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
            () => this.categoryModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Category | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.categoryModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<Category | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.categoryModel.findOneByName(name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(category: Category): Promise<Category> {
        const displayName = category.display_name?.trim();

        if (!displayName) {
            throw AppError.badRequest("Category name is required");
        }

        category.display_name = displayName;

        const existing = await this.categoryModel.findOneByName(displayName, category.branch_id);
        if (existing) {
            throw AppError.conflict("Category name already exists");
        }

        const createdCategory = await this.categoryModel.create(category);
        this.invalidateCategoryCache(createdCategory.branch_id, createdCategory.id);
        if (createdCategory.branch_id) {
            this.socketService.emitToBranch(createdCategory.branch_id, RealtimeEvents.categories.create, createdCategory);
        }
        return createdCategory;
    }

    async update(id: string, category: Category, branchId?: string): Promise<Category> {
        const categoryToUpdate = await this.categoryModel.findOne(id, branchId);
        if (!categoryToUpdate) {
            throw AppError.notFound("Category");
        }

        if (category.display_name !== undefined) {
            category.display_name = category.display_name.trim();
            if (!category.display_name) {
                throw AppError.badRequest("Category name is required");
            }
        }

        const normalizedIncomingName = category.display_name?.trim().toLowerCase();
        const normalizedCurrentName = categoryToUpdate.display_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const existing = await this.categoryModel.findOneByName(category.display_name!, categoryToUpdate.branch_id);
            if (existing && existing.id !== id) {
                throw AppError.conflict("Category name already exists");
            }
        }

        const effectiveBranchId = categoryToUpdate.branch_id || branchId || category.branch_id;
        const updatedCategory = await this.categoryModel.update(id, category, effectiveBranchId);
        this.invalidateCategoryCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.categories.update, updatedCategory);
        }
        return updatedCategory;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.categoryModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Category");
        }

        const effectiveBranchId = existing.branch_id || branchId;
        const productCount = await getRepository(Products).count({
            where: effectiveBranchId
                ? ({ category_id: id, branch_id: effectiveBranchId } as any)
                : ({ category_id: id } as any),
        });

        if (productCount > 0) {
            throw AppError.conflict("Category cannot be deleted because it is referenced by products");
        }

        const toppingCount = await getRepository(Topping)
            .createQueryBuilder("topping")
            .innerJoin("topping.categories", "category", "category.id = :categoryId", { categoryId: id })
            .andWhere(effectiveBranchId ? "topping.branch_id = :branchId" : "1=1", effectiveBranchId ? { branchId: effectiveBranchId } : {})
            .getCount();

        if (toppingCount > 0) {
            throw AppError.conflict("Category cannot be deleted because it is referenced by toppings");
        }

        await this.categoryModel.delete(id, branchId);
        this.invalidateCategoryCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.categories.delete, { id });
        }
    }
}
