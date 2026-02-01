import { Ingredients } from "../../entity/stock/Ingredients";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, invalidateCache, metadataCache } from "../../utils/cache";

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

    async findAll(filters?: { is_active?: boolean }, branchId?: string): Promise<Ingredients[]> {
        const key = cacheKey(this.CACHE_PREFIX, 'list', JSON.stringify(filters || {}), branchId);
        
        return withCache(
            key,
            () => this.ingredientsModel.findAll(filters, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<Ingredients | null> {
        const key = cacheKey(this.CACHE_PREFIX, 'single', id, branchId);
        
        return withCache(
            key,
            () => this.ingredientsModel.findOne(id, branchId),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOneByName(ingredient_name: string, branchId?: string): Promise<Ingredients | null> {
        const key = cacheKey(this.CACHE_PREFIX, 'name', ingredient_name, branchId);
        
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
            this.invalidateCache();
            this.socketService.emit('ingredients:create', createdIngredients);
            return createdIngredients;
        }
        
        return savedIngredients;
    }

    async update(id: string, ingredients: Ingredients): Promise<Ingredients> {
        await this.ingredientsModel.update(id, ingredients);
        const updatedIngredients = await this.ingredientsModel.findOne(id);
        
        if (updatedIngredients) {
            // Invalidate cache
            this.invalidateCache(id);
            this.socketService.emit('ingredients:update', updatedIngredients);
            return updatedIngredients;
        }
        
        throw new Error("พบข้อผิดพลาดในการอัปเดตวัตถุดิบ");
    }

    async delete(id: string): Promise<void> {
        await this.ingredientsModel.delete(id);
        // Invalidate cache
        this.invalidateCache(id);
        this.socketService.emit('ingredients:delete', { id });
    }

    /**
     * Invalidate ingredients cache
     */
    private invalidateCache(id?: string): void {
        const patterns = [`${this.CACHE_PREFIX}:list`];
        if (id) {
            patterns.push(`${this.CACHE_PREFIX}:single:${id}`);
        }
        invalidateCache(patterns);
    }
}
