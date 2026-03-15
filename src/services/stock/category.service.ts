import { getDbContext, getRepository } from "../../database/dbContext";
import { StockCategory } from "../../entity/stock/Category";
import { Ingredients } from "../../entity/stock/Ingredients";
import { StockCategoryModel } from "../../models/stock/category.model";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, metadataCache, withCache } from "../../utils/cache";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { SocketService } from "../socket.service";

export class StockCategoryService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "stock_category";
    private readonly CACHE_TTL = 2 * 60 * 1000;

    constructor(private stockCategoryModel: StockCategoryModel) {}

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private invalidateStockCategoryCache(branchId?: string, id?: string): void {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;

        if (!effectiveBranchId) {
            invalidateCache([`${this.CACHE_PREFIX}:`]);
            return;
        }

        const patterns = [
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "list"),
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "list_page"),
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "single"),
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "name"),
        ];

        if (id) {
            patterns.push(cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
        }

        invalidateCache(patterns);
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<StockCategory[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list", sortCreated);

        return withCache(
            key,
            () => this.stockCategoryModel.findAll(branchId, sortCreated),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: StockCategory[]; total: number; page: number; limit: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list_page",
            page,
            limit,
            sortCreated,
            (filters?.q || "").trim().toLowerCase(),
            filters?.status || "all"
        );

        return withCache(
            key,
            () => this.stockCategoryModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<StockCategory | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.stockCategoryModel.findOne(id, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<StockCategory | null> {
        const normalizedName = name.trim().toLowerCase();
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.stockCategoryModel.findOneByName(name, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async create(category: StockCategory, branchId?: string): Promise<StockCategory> {
        const effectiveBranchId = branchId || category.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const displayName = String(category.display_name || "").trim();
        if (!displayName) {
            throw AppError.badRequest("กรุณาระบุชื่อหมวดหมู่");
        }

        const existing = await this.stockCategoryModel.findOneByName(displayName, effectiveBranchId);
        if (existing) {
            throw AppError.conflict(`ชื่อหมวดหมู่ "${displayName}" ถูกใช้งานแล้ว`);
        }

        const created = await this.stockCategoryModel.create({
            ...category,
            branch_id: effectiveBranchId,
            display_name: displayName,
        });

        this.invalidateStockCategoryCache(effectiveBranchId, created.id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.stockCategories.create, created);
        return created;
    }

    async update(id: string, category: StockCategory, branchId?: string): Promise<StockCategory> {
        const existing = await this.stockCategoryModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Stock category");
        }

        const effectiveBranchId = existing.branch_id || branchId || category.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const nextDisplayName = String(category.display_name ?? existing.display_name ?? "").trim();
        if (!nextDisplayName) {
            throw AppError.badRequest("กรุณาระบุชื่อหมวดหมู่");
        }

        const duplicate = await this.stockCategoryModel.findOneByName(nextDisplayName, effectiveBranchId);
        if (duplicate && duplicate.id !== id) {
            throw AppError.conflict(`ชื่อหมวดหมู่ "${nextDisplayName}" ถูกใช้งานแล้ว`);
        }

        const updated = await this.stockCategoryModel.update(
            id,
            {
                ...existing,
                ...category,
                branch_id: effectiveBranchId,
                display_name: nextDisplayName,
            },
            effectiveBranchId
        );

        this.invalidateStockCategoryCache(effectiveBranchId, id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.stockCategories.update, updated);
        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.stockCategoryModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Stock category");
        }

        const effectiveBranchId = existing.branch_id || branchId;
        const linkedIngredientsCount = await getRepository(Ingredients).count({
            where: effectiveBranchId
                ? ({ category_id: id, branch_id: effectiveBranchId } as any)
                : ({ category_id: id } as any),
        });

        if (linkedIngredientsCount > 0) {
            throw AppError.conflict(
                `ลบหมวดหมู่ไม่ได้ เนื่องจากยังมีวัตถุดิบ ${linkedIngredientsCount} รายการอ้างอิงอยู่`
            );
        }

        await this.stockCategoryModel.delete(id, effectiveBranchId);
        this.invalidateStockCategoryCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.stockCategories.delete, { id });
        }
    }
}
