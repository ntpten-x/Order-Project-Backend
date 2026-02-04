"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsModels = void 0;
const Products_1 = require("../../entity/pos/Products");
const dbHelpers_1 = require("../../utils/dbHelpers");
const cache_1 = require("../../utils/cache");
const dbContext_1 = require("../../database/dbContext");
/**
 * Products Model with optimized queries
 * Following supabase-postgres-best-practices:
 * - Uses indexed columns in WHERE clauses
 * - Implements query caching for read-heavy operations
 * - Uses parameterized queries to prevent SQL injection
 */
class ProductsModels {
    constructor() {
        this.CACHE_PREFIX = 'products';
        this.CACHE_TTL = 2 * 60 * 1000; // 2 minutes
    }
    getCacheScopeParts(branchId) {
        const ctx = (0, dbContext_1.getDbContext)();
        const effectiveBranchId = branchId !== null && branchId !== void 0 ? branchId : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
        if (effectiveBranchId)
            return ["branch", effectiveBranchId];
        if (ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin)
            return ["admin"];
        return ["public"];
    }
    /**
     * Find all products with pagination, filtering, and search
     * Uses indexed columns: category_id, product_name, is_active, branch_id
     */
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, category_id, q, is_active, branchId) {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'list', page, limit, category_id, q, is_active);
            // Skip cache if search query exists (too many variants)
            if (q === null || q === void 0 ? void 0 : q.trim()) {
                return this.findAllQuery(page, limit, category_id, q, is_active, branchId);
            }
            return (0, cache_1.withCache)(key, () => this.findAllQuery(page, limit, category_id, q, is_active, branchId), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    findAllQuery(page, limit, category_id, q, is_active, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const productsRepository = (0, dbContext_1.getRepository)(Products_1.Products);
            let query = productsRepository.createQueryBuilder("products")
                .leftJoinAndSelect("products.category", "category")
                .leftJoinAndSelect("products.unit", "unit")
                .orderBy("products.create_date", "ASC");
            // Filter by branch_id for data isolation
            if (branchId) {
                query.andWhere("products.branch_id = :branchId", { branchId });
            }
            // Use indexed category_id filter
            query = (0, dbHelpers_1.addFilterCondition)(query, category_id, "category_id", "products");
            // Use indexed is_active filter
            query = (0, dbHelpers_1.addBooleanFilter)(query, is_active, "is_active", "products");
            // Search uses indexed product_name column
            query = (0, dbHelpers_1.addSearchCondition)(query, q, ["product_name", "display_name", "description"], "products");
            return (0, dbHelpers_1.paginate)(query, { page, limit });
        });
    }
    /**
     * Find single product by ID
     * ID is primary key (indexed)
     */
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'single', id);
            return (0, cache_1.withCache)(key, () => {
                const productsRepository = (0, dbContext_1.getRepository)(Products_1.Products);
                const query = productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .where("products.id = :id", { id });
                if (branchId) {
                    query.andWhere("products.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }, this.CACHE_TTL, cache_1.queryCache);
        });
    }
    /**
     * Find product by name
     * Uses indexed product_name column
     */
    findOneByName(product_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'name', product_name);
            return (0, cache_1.withCache)(key, () => {
                const productsRepository = (0, dbContext_1.getRepository)(Products_1.Products);
                const query = productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .where("products.product_name = :product_name", { product_name });
                if (branchId) {
                    query.andWhere("products.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }, this.CACHE_TTL, cache_1.queryCache);
        });
    }
    /**
     * Create new product
     * Invalidates cache after creation
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const productsRepository = (0, dbContext_1.getRepository)(Products_1.Products);
            const result = yield productsRepository
                .createQueryBuilder("products")
                .insert()
                .values(data)
                .returning("id")
                .execute();
            // Invalidate list cache
            this.invalidateProductCache(data.branch_id);
            return result.raw[0];
        });
    }
    /**
     * Update existing product
     * Invalidates cache after update
     */
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const productsRepository = (0, dbContext_1.getRepository)(Products_1.Products);
            const result = yield productsRepository
                .createQueryBuilder("products")
                .update(data)
                .where("products.id = :id", { id })
                .andWhere(branchId ? "products.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
                .returning("id")
                .execute();
            // Invalidate relevant caches
            this.invalidateProductCache(branchId !== null && branchId !== void 0 ? branchId : data.branch_id, id);
            return result.raw[0];
        });
    }
    /**
     * Delete product
     * Invalidates cache after deletion
     */
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const productsRepository = (0, dbContext_1.getRepository)(Products_1.Products);
            yield productsRepository
                .createQueryBuilder("products")
                .delete()
                .where("products.id = :id", { id })
                .andWhere(branchId ? "products.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
                .execute();
            // Invalidate relevant caches
            this.invalidateProductCache(branchId, id);
        });
    }
    /**
     * Invalidate product cache
     * Called after create/update/delete operations
     */
    invalidateProductCache(branchId, id) {
        if (!branchId)
            return;
        const patterns = [
            (0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", branchId, "list"),
            (0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", branchId, "name"),
            (0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", branchId, "count-by-category"),
        ];
        if (id) {
            patterns.push((0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", branchId, "single", id));
        }
        (0, cache_1.invalidateCache)(patterns);
    }
    /**
     * Get product count by category
     * Useful for dashboard statistics
     */
    countByCategory() {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts();
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'count-by-category');
            return (0, cache_1.withCache)(key, () => (0, dbContext_1.getRepository)(Products_1.Products)
                .createQueryBuilder("products")
                .select("products.category_id", "category_id")
                .addSelect("COUNT(*)", "count")
                .groupBy("products.category_id")
                .getRawMany(), 5 * 60 * 1000, // 5 minutes cache for aggregates
            cache_1.queryCache);
        });
    }
}
exports.ProductsModels = ProductsModels;
