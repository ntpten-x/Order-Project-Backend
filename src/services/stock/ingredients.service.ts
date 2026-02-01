import { Ingredients } from "../../entity/stock/Ingredients";
import { IngredientsModel } from "../../models/stock/ingredients.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, invalidateCache, metadataCache } from "../../utils/cache";

/**
 * Ingredients Service with Caching
 * Following supabase-postgres-best-practices: server-cache-lru
 */
export class IngredientsService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = 'ingredients';
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

    constructor(private ingredientsModel: IngredientsModel) { }

    async findAll(filters?: { is_active?: boolean }): Promise<Ingredients[]> {
        const key = cacheKey(this.CACHE_PREFIX, 'list', JSON.stringify(filters || {}));
        
        return withCache(
            key,
            () => this.ingredientsModel.findAll(filters),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOne(id: string): Promise<Ingredients | null> {
        const key = cacheKey(this.CACHE_PREFIX, 'single', id);
        
        return withCache(
            key,
            () => this.ingredientsModel.findOne(id),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async findOneByName(ingredient_name: string): Promise<Ingredients | null> {
        const key = cacheKey(this.CACHE_PREFIX, 'name', ingredient_name);
        
        return withCache(
            key,
            () => this.ingredientsModel.findOneByName(ingredient_name),
            this.CACHE_TTL,
            metadataCache as any
        );
    }

    async create(ingredients: Ingredients): Promise<Ingredients> {
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
