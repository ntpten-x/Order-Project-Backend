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
const database_1 = require("../../database/database");
const Products_1 = require("../../entity/pos/Products");
const dbHelpers_1 = require("../../utils/dbHelpers");
const cache_1 = require("../../utils/cache");
/**
 * Products Model with optimized queries
 * Following supabase-postgres-best-practices:
 * - Uses indexed columns in WHERE clauses
 * - Implements query caching for read-heavy operations
 * - Uses parameterized queries to prevent SQL injection
 */
class ProductsModels {
    constructor() {
        this.productsRepository = database_1.AppDataSource.getRepository(Products_1.Products);
        this.CACHE_PREFIX = 'products';
        this.CACHE_TTL = 2 * 60 * 1000; // 2 minutes
    }
    /**
     * Find all products with pagination, filtering, and search
     * Uses indexed columns: category_id, product_name, is_active, branch_id
     */
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, category_id, q, is_active, branchId) {
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, 'list', page, limit, category_id, q, is_active, branchId);
            // Skip cache if search query exists (too many variants)
            if (q === null || q === void 0 ? void 0 : q.trim()) {
                return this.findAllQuery(page, limit, category_id, q, is_active, branchId);
            }
            return (0, cache_1.withCache)(key, () => this.findAllQuery(page, limit, category_id, q, is_active, branchId), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    findAllQuery(page, limit, category_id, q, is_active, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = this.productsRepository.createQueryBuilder("products")
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
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, 'single', id, branchId);
            return (0, cache_1.withCache)(key, () => {
                const query = this.productsRepository.createQueryBuilder("products")
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
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, 'name', product_name, branchId);
            return (0, cache_1.withCache)(key, () => {
                const query = this.productsRepository.createQueryBuilder("products")
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
            const result = yield this.productsRepository
                .createQueryBuilder("products")
                .insert()
                .values(data)
                .returning("id")
                .execute();
            // Invalidate list cache
            this.invalidateProductCache();
            return result.raw[0];
        });
    }
    /**
     * Update existing product
     * Invalidates cache after update
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.productsRepository
                .createQueryBuilder("products")
                .update(data)
                .where("products.id = :id", { id })
                .returning("id")
                .execute();
            // Invalidate relevant caches
            this.invalidateProductCache(id);
            return result.raw[0];
        });
    }
    /**
     * Delete product
     * Invalidates cache after deletion
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.productsRepository
                .createQueryBuilder("products")
                .delete()
                .where("products.id = :id", { id })
                .execute();
            // Invalidate relevant caches
            this.invalidateProductCache(id);
        });
    }
    /**
     * Invalidate product cache
     * Called after create/update/delete operations
     */
    invalidateProductCache(id) {
        const patterns = [`${this.CACHE_PREFIX}:list`];
        if (id) {
            patterns.push(`${this.CACHE_PREFIX}:single:${id}`);
        }
        (0, cache_1.invalidateCache)(patterns);
    }
    /**
     * Get product count by category
     * Useful for dashboard statistics
     */
    countByCategory() {
        return __awaiter(this, void 0, void 0, function* () {
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, 'count-by-category');
            return (0, cache_1.withCache)(key, () => this.productsRepository
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
