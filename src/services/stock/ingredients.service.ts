import { getDbContext, getRepository } from "../../database/dbContext";
import { Ingredients } from "../../entity/stock/Ingredients";
import { IngredientsUnit } from "../../entity/stock/IngredientsUnit";
import { StockOrdersItem } from "../../entity/stock/OrdersItem";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, metadataCache, withCache } from "../../utils/cache";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { SocketService } from "../socket.service";

export class IngredientsService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "ingredients";
    private readonly CACHE_TTL = 2 * 60 * 1000;

    constructor(private ingredientsModel: IngredientsModel) {}

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private invalidateIngredientsCache(branchId?: string, id?: string): void {
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
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "display_name"),
        ];

        if (id) {
            patterns.push(cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
        }

        invalidateCache(patterns);
    }

    private normalizeDisplayName(displayName?: string | null): string {
        return String(displayName || "").trim();
    }

    private normalizeDescription(description?: string | null): string {
        return String(description || "").trim();
    }

    async findAll(
        filters?: { is_active?: boolean },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<Ingredients[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list", sortCreated, JSON.stringify(filters || {}));

        return withCache(
            key,
            () => this.ingredientsModel.findAll(filters, branchId, sortCreated),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { is_active?: boolean; q?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Ingredients[]; total: number; page: number; limit: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list_page",
            page,
            limit,
            sortCreated,
            JSON.stringify(filters || {})
        );

        return withCache(
            key,
            () => this.ingredientsModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Ingredients | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.ingredientsModel.findOne(id, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOneByDisplayName(displayName: string, branchId?: string): Promise<Ingredients | null> {
        const normalizedDisplayName = this.normalizeDisplayName(displayName).toLowerCase();
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "display_name", normalizedDisplayName);

        return withCache(
            key,
            () => this.ingredientsModel.findOneByDisplayName(normalizedDisplayName, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async create(ingredients: Ingredients, branchId?: string): Promise<Ingredients> {
        const effectiveBranchId = branchId || ingredients.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const displayName = this.normalizeDisplayName(ingredients.display_name);
        const description = this.normalizeDescription(ingredients.description);
        const unitId = String(ingredients.unit_id || "").trim();

        if (!displayName) {
            throw AppError.badRequest("กรุณาระบุชื่อวัตถุดิบที่ใช้แสดง");
        }

        if (!unitId) {
            throw AppError.badRequest("กรุณาเลือกหน่วยนับวัตถุดิบ");
        }

        const unit = await getRepository(IngredientsUnit).findOne({
            where: {
                id: unitId,
                branch_id: effectiveBranchId,
            } as any,
        });

        if (!unit) {
            throw AppError.badRequest("ไม่พบหน่วยนับวัตถุดิบในสาขาปัจจุบัน");
        }

        const duplicateByDisplayName = await this.ingredientsModel.findOneByDisplayName(displayName, effectiveBranchId);
        if (duplicateByDisplayName) {
            throw AppError.conflict(`ชื่อวัตถุดิบ "${displayName}" ถูกใช้งานแล้ว`);
        }

        const savedIngredients = await this.ingredientsModel.create({
            ...ingredients,
            branch_id: effectiveBranchId,
            display_name: displayName,
            description,
            unit_id: unitId,
        } as Ingredients);

        const createdIngredients = await this.ingredientsModel.findOne(savedIngredients.id, effectiveBranchId);
        if (!createdIngredients) {
            throw AppError.internal("สร้างวัตถุดิบไม่สำเร็จ");
        }

        this.invalidateIngredientsCache(effectiveBranchId, createdIngredients.id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredients.create, createdIngredients);
        return createdIngredients;
    }

    async update(id: string, ingredients: Ingredients, branchId?: string): Promise<Ingredients> {
        const existing = await this.ingredientsModel.findOne(id, branchId);
        if (!existing) {
            throw new AppError("ไม่พบวัตถุดิบ", 404);
        }

        const effectiveBranchId = branchId || existing.branch_id || ingredients.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const nextDisplayName = this.normalizeDisplayName(ingredients.display_name ?? existing.display_name);
        const nextDescription = this.normalizeDescription(ingredients.description ?? existing.description);
        const nextUnitId = String(ingredients.unit_id || existing.unit_id || "").trim();

        if (!nextDisplayName) {
            throw AppError.badRequest("กรุณาระบุชื่อวัตถุดิบที่ใช้แสดง");
        }

        if (!nextUnitId) {
            throw AppError.badRequest("กรุณาเลือกหน่วยนับวัตถุดิบ");
        }

        const unit = await getRepository(IngredientsUnit).findOne({
            where: {
                id: nextUnitId,
                branch_id: effectiveBranchId,
            } as any,
        });

        if (!unit) {
            throw AppError.badRequest("ไม่พบหน่วยนับวัตถุดิบในสาขาปัจจุบัน");
        }

        const duplicateByDisplayName = await this.ingredientsModel.findOneByDisplayName(nextDisplayName, effectiveBranchId);
        if (duplicateByDisplayName && duplicateByDisplayName.id !== id) {
            throw AppError.conflict(`ชื่อวัตถุดิบ "${nextDisplayName}" ถูกใช้งานแล้ว`);
        }

        await this.ingredientsModel.update(
            id,
            {
                ...existing,
                ...ingredients,
                branch_id: effectiveBranchId,
                display_name: nextDisplayName,
                description: nextDescription,
                unit_id: nextUnitId,
            } as Ingredients,
            effectiveBranchId
        );

        const updatedIngredients = await this.ingredientsModel.findOne(id, effectiveBranchId);
        if (!updatedIngredients) {
            throw AppError.internal("บันทึกการแก้ไขวัตถุดิบไม่สำเร็จ");
        }

        this.invalidateIngredientsCache(effectiveBranchId, id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredients.update, updatedIngredients);
        return updatedIngredients;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.ingredientsModel.findOne(id, branchId);
        if (!existing) {
            throw new AppError("ไม่พบวัตถุดิบ", 404);
        }

        const effectiveBranchId = branchId || existing.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const linkedOrderItemsCount = await getRepository(StockOrdersItem).count({
            where: {
                ingredient_id: id,
            } as any,
        });

        if (linkedOrderItemsCount > 0) {
            throw AppError.conflict(
                `ลบวัตถุดิบไม่ได้ เนื่องจากยังมีรายการสั่งซื้อ ${linkedOrderItemsCount} รายการอ้างอิงอยู่`
            );
        }

        await this.ingredientsModel.delete(id, effectiveBranchId);
        this.invalidateIngredientsCache(effectiveBranchId, id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredients.delete, { id });
    }
}
