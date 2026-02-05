import { Ingredients } from "../../entity/stock/Ingredients";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, invalidateCache, metadataCache } from "../../utils/cache";
import { getDbContext } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";

/**
 * Ingredients Service with Caching
 * Following supabase-postgres-best-practices: server-cache-lru
 * Branch-based data isolation supported
 */
export class IngredientsService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = 'ingredients';
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

    constructor(private ingredientsModel: IngredientsModel) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    async findAll(filters?: { is_active?: boolean }, branchId?: string): Promise<Ingredients[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'list', JSON.stringify(filters || {}));
        
        return withCache(
            key,
            () => this.ingredientsModel.findAll(filters, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Ingredients | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'single', id);
        
        return withCache(
            key,
            () => this.ingredientsModel.findOne(id, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOneByName(ingredient_name: string, branchId?: string): Promise<Ingredients | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'name', ingredient_name);
        
        return withCache(
            key,
            () => this.ingredientsModel.findOneByName(ingredient_name, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async create(ingredients: Ingredients): Promise<Ingredients> {
        // Check for duplicate name within the same branch
        if (ingredients.ingredient_name && ingredients.branch_id) {
            const existing = await this.ingredientsModel.findOneByName(ingredients.ingredient_name, ingredients.branch_id);
            if (existing) {
                throw new Error("ชื่อวัตถุดิบนี้มีอยู่ในระบบแล้ว");
            }
        }
        
        const savedIngredients = await this.ingredientsModel.create(ingredients);
        const createdIngredients = await this.ingredientsModel.findOne(savedIngredients.id);
        
        if (createdIngredients) {
            // Invalidate cache
            this.invalidateCache(createdIngredients.branch_id);
            if (createdIngredients.branch_id) {
                this.socketService.emitToBranch(createdIngredients.branch_id, RealtimeEvents.ingredients.create, createdIngredients);
            }
            return createdIngredients;
        }
        
        return savedIngredients;
    }

    async update(id: string, ingredients: Ingredients, branchId?: string): Promise<Ingredients> {
        const existing = await this.ingredientsModel.findOne(id, branchId);
        if (!existing) throw new Error("Ingredient not found");

        const effectiveBranchId = branchId || existing.branch_id || ingredients.branch_id;
        if (effectiveBranchId) {
            ingredients.branch_id = effectiveBranchId;
        }

        await this.ingredientsModel.update(id, ingredients, effectiveBranchId);
        const updatedIngredients = await this.ingredientsModel.findOne(id, effectiveBranchId);
        
        if (updatedIngredients) {
            // Invalidate cache
            this.invalidateCache(effectiveBranchId, id);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredients.update, updatedIngredients);
            }
            return updatedIngredients;
        }
        
        throw new Error("พบข้อผิดพลาดในการอัปเดตวัตถุดิบ");
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.ingredientsModel.findOne(id, branchId);
        if (!existing) throw new Error("Ingredient not found");

        const effectiveBranchId = branchId || existing.branch_id;
        await this.ingredientsModel.delete(id, effectiveBranchId);
        // Invalidate cache
        this.invalidateCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredients.delete, { id });
        }
    }

    /**
     * Invalidate ingredients cache
     */
    private invalidateCache(branchId?: string, id?: string): void {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (!effectiveBranchId) {
            invalidateCache([`${this.CACHE_PREFIX}:`]);
            return;
        }

        const patterns = [
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "list"),
            cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "name"),
        ];
        if (id) {
            patterns.push(cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
        }
        invalidateCache(patterns);
    }
}
