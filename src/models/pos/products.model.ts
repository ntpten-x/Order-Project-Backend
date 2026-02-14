import { Products } from "../../entity/pos/Products";
import { 
    paginate, 
    addSearchCondition, 
    addFilterCondition,
    addBooleanFilter,
    PaginatedResult 
} from "../../utils/dbHelpers";
import { withCache, cacheKey, invalidateCache, queryCache } from "../../utils/cache";
import { getDbContext, getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

/**
 * Products Model with optimized queries
 * Following supabase-postgres-best-practices:
 * - Uses indexed columns in WHERE clauses
 * - Implements query caching for read-heavy operations
 * - Uses parameterized queries to prevent SQL injection
 */
export class ProductsModels {
    private readonly CACHE_PREFIX = 'products';
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

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
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<PaginatedResult<Products>> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'list', page, limit, category_id, q, is_active, sortCreated);
        
        // Skip cache if search query exists (too many variants)
        if (q?.trim()) {
            return this.findAllQuery(page, limit, category_id, q, is_active, branchId, sortCreated);
        }
        
        return withCache(
            key,
            () => this.findAllQuery(page, limit, category_id, q, is_active, branchId, sortCreated),
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
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<PaginatedResult<Products>> {
        const productsRepository = getRepository(Products);
        let query = productsRepository.createQueryBuilder("products")
            .leftJoinAndSelect("products.category", "category")
            .leftJoinAndSelect("products.unit", "unit")
            .orderBy("products.create_date", createdSortToOrder(sortCreated));

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
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'single', id);
        
        return withCache(
            key,
            () => {
                const productsRepository = getRepository(Products);
                const query = productsRepository.createQueryBuilder("products")
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
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'name', product_name);
        
        return withCache(
            key,
            () => {
                const productsRepository = getRepository(Products);
                const query = productsRepository.createQueryBuilder("products")
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
        const productsRepository = getRepository(Products);
        const result = await productsRepository
            .createQueryBuilder("products")
            .insert()
            .values(data)
            .returning("id")
            .execute();
        
        // Invalidate list cache
        this.invalidateProductCache(data.branch_id);
        
        return result.raw[0];
    }

    /**
     * Update existing product
     * Invalidates cache after update
     */
    async update(id: string, data: Products, branchId?: string): Promise<Products> {
        const productsRepository = getRepository(Products);
        const result = await productsRepository
            .createQueryBuilder("products")
            .update(data)
            .where("products.id = :id", { id })
            .andWhere(branchId ? "products.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
            .returning("id")
            .execute();
        
        // Invalidate relevant caches
        this.invalidateProductCache(branchId ?? data.branch_id, id);
        
        return result.raw[0];
    }

    /**
     * Delete product
     * Invalidates cache after deletion
     */
    async delete(id: string, branchId?: string): Promise<void> {
        const productsRepository = getRepository(Products);
        await productsRepository
            .createQueryBuilder("products")
            .delete()
            .where("products.id = :id", { id })
            .andWhere(branchId ? "products.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
            .execute();
        
        // Invalidate relevant caches
        this.invalidateProductCache(branchId, id);
    }

    /**
     * Invalidate product cache
     * Called after create/update/delete operations
     */
    private invalidateProductCache(branchId?: string, id?: string): void {
        if (!branchId) return;

        const patterns = [
            cacheKey(this.CACHE_PREFIX, "branch", branchId, "list"),
            cacheKey(this.CACHE_PREFIX, "branch", branchId, "name"),
            cacheKey(this.CACHE_PREFIX, "branch", branchId, "count-by-category"),
        ];

        if (id) {
            patterns.push(cacheKey(this.CACHE_PREFIX, "branch", branchId, "single", id));
        }

        invalidateCache(patterns);
    }

    /**
     * Get product count by category
     * Useful for dashboard statistics
     */
    async countByCategory(): Promise<{ category_id: string; count: number }[]> {
        const scope = this.getCacheScopeParts();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'count-by-category');
        
        return withCache(
            key,
            () => getRepository(Products)
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
