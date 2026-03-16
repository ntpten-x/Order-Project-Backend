import { getDbContext, getRepository } from "../../database/dbContext";
import { Ingredients } from "../../entity/stock/Ingredients";
import { IngredientsUnit } from "../../entity/stock/IngredientsUnit";
import { IngredientsUnitModel } from "../../models/stock/ingredientsUnit.model";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, metadataCache, withCache } from "../../utils/cache";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { SocketService } from "../socket.service";

export class IngredientsUnitService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "ingredients_unit";
    private readonly CACHE_TTL = 2 * 60 * 1000;

    constructor(private ingredientsUnitModel: IngredientsUnitModel) {}

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private invalidateIngredientsUnitCache(branchId?: string, id?: string): void {
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
            cacheKey(this.CACHE_PREFIX, "admin", "list"),
            cacheKey(this.CACHE_PREFIX, "admin", "list_page"),
            cacheKey(this.CACHE_PREFIX, "admin", "single"),
            cacheKey(this.CACHE_PREFIX, "admin", "display_name"),
            cacheKey(this.CACHE_PREFIX, "public", "list"),
            cacheKey(this.CACHE_PREFIX, "public", "list_page"),
            cacheKey(this.CACHE_PREFIX, "public", "single"),
            cacheKey(this.CACHE_PREFIX, "public", "display_name"),
        ];

        if (id) {
            patterns.push(cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
            patterns.push(cacheKey(this.CACHE_PREFIX, "admin", "single", id));
            patterns.push(cacheKey(this.CACHE_PREFIX, "public", "single", id));
        }

        invalidateCache(patterns);
    }

    private normalizeDisplayName(displayName?: string | null): string {
        return String(displayName || "").trim();
    }

    async findAll(
        filters?: { is_active?: boolean },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<IngredientsUnit[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list", sortCreated, JSON.stringify(filters || {}));

        return withCache(
            key,
            () => this.ingredientsUnitModel.findAll(filters, branchId, sortCreated),
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
    ): Promise<{ data: IngredientsUnit[]; total: number; page: number; limit: number; last_page: number }> {
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
            () => this.ingredientsUnitModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<IngredientsUnit | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.ingredientsUnitModel.findOne(id, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async create(ingredientsUnit: IngredientsUnit, branchId?: string): Promise<IngredientsUnit> {
        const effectiveBranchId = branchId || ingredientsUnit.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const displayName = this.normalizeDisplayName(ingredientsUnit.display_name);
        if (!displayName) {
            throw AppError.badRequest("กรุณาระบุชื่อหน่วยนับที่ใช้แสดง");
        }

        const duplicateByDisplayName = await this.ingredientsUnitModel.findOneByDisplayName(displayName, effectiveBranchId);
        if (duplicateByDisplayName) {
            throw AppError.conflict(`ชื่อหน่วยนับ "${displayName}" ถูกใช้งานแล้ว`);
        }

        const savedIngredientsUnit = await this.ingredientsUnitModel.create({
            ...ingredientsUnit,
            branch_id: effectiveBranchId,
            display_name: displayName,
        } as IngredientsUnit);

        const createdIngredientsUnit = await this.ingredientsUnitModel.findOne(savedIngredientsUnit.id, effectiveBranchId);
        if (!createdIngredientsUnit) {
            throw AppError.internal("สร้างหน่วยนับวัตถุดิบไม่สำเร็จ");
        }

        this.invalidateIngredientsUnitCache(effectiveBranchId, createdIngredientsUnit.id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredientsUnit.create, createdIngredientsUnit);
        return createdIngredientsUnit;
    }

    async update(id: string, ingredientsUnit: IngredientsUnit, branchId?: string): Promise<IngredientsUnit> {
        const existing = await this.ingredientsUnitModel.findOne(id, branchId);
        if (!existing) {
            throw new AppError("ไม่พบหน่วยนับวัตถุดิบ", 404);
        }

        const effectiveBranchId = branchId || existing.branch_id || ingredientsUnit.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const nextDisplayName = this.normalizeDisplayName(ingredientsUnit.display_name ?? existing.display_name);
        if (!nextDisplayName) {
            throw AppError.badRequest("กรุณาระบุชื่อหน่วยนับที่ใช้แสดง");
        }

        const duplicateByDisplayName = await this.ingredientsUnitModel.findOneByDisplayName(nextDisplayName, effectiveBranchId);
        if (duplicateByDisplayName && duplicateByDisplayName.id !== id) {
            throw AppError.conflict(`ชื่อหน่วยนับ "${nextDisplayName}" ถูกใช้งานแล้ว`);
        }

        await this.ingredientsUnitModel.update(
            id,
            {
                ...existing,
                ...ingredientsUnit,
                branch_id: effectiveBranchId,
                display_name: nextDisplayName,
            } as IngredientsUnit,
            effectiveBranchId
        );

        const updatedIngredientsUnit = await this.ingredientsUnitModel.findOne(id, effectiveBranchId);
        if (!updatedIngredientsUnit) {
            throw AppError.internal("บันทึกการแก้ไขหน่วยนับวัตถุดิบไม่สำเร็จ");
        }

        this.invalidateIngredientsUnitCache(effectiveBranchId, id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredientsUnit.update, updatedIngredientsUnit);
        return updatedIngredientsUnit;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.ingredientsUnitModel.findOne(id, branchId);
        if (!existing) {
            throw new AppError("ไม่พบหน่วยนับวัตถุดิบ", 404);
        }

        const effectiveBranchId = branchId || existing.branch_id;
        if (!effectiveBranchId) {
            throw AppError.badRequest("ไม่พบสาขาที่ต้องการใช้งาน");
        }

        const linkedIngredientsCount = await getRepository(Ingredients).count({
            where: {
                unit_id: id,
                branch_id: effectiveBranchId,
            } as any,
        });

        if (linkedIngredientsCount > 0) {
            throw AppError.conflict(
                `ลบหน่วยนับไม่ได้ เนื่องจากยังมีวัตถุดิบ ${linkedIngredientsCount} รายการอ้างอิงอยู่`
            );
        }

        await this.ingredientsUnitModel.delete(id, effectiveBranchId);
        this.invalidateIngredientsUnitCache(effectiveBranchId, id);
        this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredientsUnit.delete, { id });
    }
}
