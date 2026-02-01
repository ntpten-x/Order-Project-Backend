import { AppDataSource } from "../../database/database";
import { Products } from "../../entity/pos/Products";
import { 
    paginate, 
    addSearchCondition, 
    addFilterCondition,
    addBooleanFilter,
    PaginatedResult 
} from "../../utils/dbHelpers";
import { withCache, cacheKey, invalidateCache, queryCache } from "../../utils/cache";

/**
 * Products Model with optimized queries
 * Following supabase-postgres-best-practices:
 * - Uses indexed columns in WHERE clauses
 * - Implements query caching for read-heavy operations
 * - Uses parameterized queries to prevent SQL injection
 */
export class ProductsModels {
    private productsRepository = AppDataSource.getRepository(Products);
    private readonly CACHE_PREFIX = 'products';
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

    /**
     * Find all products with pagination, filtering, and search
     * Uses indexed columns: category_id, product_name, is_active, branch_id
     */
    async findAll(
        page: number = 1,
        limit: number = 50,
        category_id?: string,
        q?: string,
        is_active?: boolean,
        branchId?: string
    ): Promise<PaginatedResult<Products>> {
        const key = cacheKey(this.CACHE_PREFIX, 'list', page, limit, category_id, q, is_active, branchId);
        
        // Skip cache if search query exists (too many variants)
        if (q?.trim()) {
            return this.findAllQuery(page, limit, category_id, q, is_active, branchId);
        }
        
        return withCache(
            key,
            () => this.findAllQuery(page, limit, category_id, q, is_active, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    private async findAllQuery(
        page: number,
        limit: number,
        category_id?: string,
        q?: string,
        is_active?: boolean,
        branchId?: string
    ): Promise<PaginatedResult<Products>> {
        let query = this.productsRepository.createQueryBuilder("products")
            .leftJoinAndSelect("products.category", "category")
            .leftJoinAndSelect("products.unit", "unit")
            .orderBy("products.create_date", "ASC");

        // Filter by branch_id for data isolation
        if (branchId) {
            query.andWhere("products.branch_id = :branchId", { branchId });
        }

        // Use indexed category_id filter
        query = addFilterCondition(query, category_id, "category_id", "products");
        
        // Use indexed is_active filter
        query = addBooleanFilter(query, is_active, "is_active", "products");
        
        // Search uses indexed product_name column
        query = addSearchCondition(
            query, 
            q, 
            ["product_name", "display_name", "description"], 
            "products"
        );

        return paginate(query, { page, limit });
    }

    /**
     * Find single product by ID
     * ID is primary key (indexed)
     */
    async findOne(id: string, branchId?: string): Promise<Products | null> {
        const key = cacheKey(this.CACHE_PREFIX, 'single', id, branchId);
        
        return withCache(
            key,
            () => {
                const query = this.productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .where("products.id = :id", { id });
                
                if (branchId) {
                    query.andWhere("products.branch_id = :branchId", { branchId });
                }
                
                return query.getOne();
            },
            this.CACHE_TTL,
            queryCache as any
        );
    }

    /**
     * Find product by name
     * Uses indexed product_name column
     */
    async findOneByName(product_name: string, branchId?: string): Promise<Products | null> {
        const key = cacheKey(this.CACHE_PREFIX, 'name', product_name, branchId);
        
        return withCache(
            key,
            () => {
                const query = this.productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .where("products.product_name = :product_name", { product_name });
                
                if (branchId) {
                    query.andWhere("products.branch_id = :branchId", { branchId });
                }
                
                return query.getOne();
            },
            this.CACHE_TTL,
            queryCache as any
        );
    }

    /**
     * Create new product
     * Invalidates cache after creation
     */
    async create(data: Products): Promise<Products> {
        const result = await this.productsRepository
            .createQueryBuilder("products")
            .insert()
            .values(data)
            .returning("id")
            .execute();
        
        // Invalidate list cache
        this.invalidateProductCache();
        
        return result.raw[0];
    }

    /**
     * Update existing product
     * Invalidates cache after update
     */
    async update(id: string, data: Products): Promise<Products> {
        const result = await this.productsRepository
            .createQueryBuilder("products")
            .update(data)
            .where("products.id = :id", { id })
            .returning("id")
            .execute();
        
        // Invalidate relevant caches
        this.invalidateProductCache(id);
        
        return result.raw[0];
    }

    /**
     * Delete product
     * Invalidates cache after deletion
     */
    async delete(id: string): Promise<void> {
        await this.productsRepository
            .createQueryBuilder("products")
            .delete()
            .where("products.id = :id", { id })
            .execute();
        
        // Invalidate relevant caches
        this.invalidateProductCache(id);
    }

    /**
     * Invalidate product cache
     * Called after create/update/delete operations
     */
    private invalidateProductCache(id?: string): void {
        const patterns = [`${this.CACHE_PREFIX}:list`];
        
        if (id) {
            patterns.push(`${this.CACHE_PREFIX}:single:${id}`);
        }
        
        invalidateCache(patterns);
    }

    /**
     * Get product count by category
     * Useful for dashboard statistics
     */
    async countByCategory(): Promise<{ category_id: string; count: number }[]> {
        const key = cacheKey(this.CACHE_PREFIX, 'count-by-category');
        
        return withCache(
            key,
            () => this.productsRepository
                .createQueryBuilder("products")
                .select("products.category_id", "category_id")
                .addSelect("COUNT(*)", "count")
                .groupBy("products.category_id")
                .getRawMany(),
            5 * 60 * 1000, // 5 minutes cache for aggregates
            queryCache as any
        );
    }
}
