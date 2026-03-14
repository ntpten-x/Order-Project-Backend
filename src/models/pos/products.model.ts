import { getDbContext, getRepository } from "../../database/dbContext";
import { Products } from "../../entity/pos/Products";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";
import {
    PaginatedResult,
    addBooleanFilter,
    addFilterCondition,
    addSearchCondition,
} from "../../utils/dbHelpers";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

/**
 * Product read/write model optimized for paginated reads with many-to-many topping groups.
 */
export class ProductsModels {
    private readonly CACHE_PREFIX = "products";
    private readonly CACHE_TTL = 10 * 60 * 1000;

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private async loadByIds(
        ids: string[],
        branchId?: string,
        sortCreated: CreatedSort = "old",
    ): Promise<Products[]> {
        if (ids.length === 0) return [];

        const productsRepository = getRepository(Products);
        const items = await productsRepository
            .createQueryBuilder("products")
            .leftJoinAndSelect("products.category", "category")
            .leftJoinAndSelect("products.unit", "unit")
            .leftJoinAndSelect("products.topping_groups", "topping_group")
            .where("products.id IN (:...ids)", { ids })
            .andWhere(branchId ? "products.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
            .orderBy("products.create_date", createdSortToOrder(sortCreated))
            .addOrderBy("topping_group.display_name", "ASC")
            .getMany();

        const orderMap = new Map(ids.map((id, index) => [id, index]));
        return items.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    }

    async findAll(
        page: number = 1,
        limit: number = 50,
        category_id?: string,
        q?: string,
        is_active?: boolean,
        branchId?: string,
        sortCreated: CreatedSort = "old",
    ): Promise<PaginatedResult<Products>> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list", page, limit, category_id, q, is_active, sortCreated);

        if (q?.trim()) {
            return this.findAllQuery(page, limit, category_id, q, is_active, branchId, sortCreated);
        }

        return withCache(
            key,
            () => this.findAllQuery(page, limit, category_id, q, is_active, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any,
        );
    }

    private async findAllQuery(
        page: number,
        limit: number,
        category_id?: string,
        q?: string,
        is_active?: boolean,
        branchId?: string,
        sortCreated: CreatedSort = "old",
    ): Promise<PaginatedResult<Products>> {
        const productsRepository = getRepository(Products);
        let baseQuery = productsRepository.createQueryBuilder("products");

        if (branchId) {
            baseQuery.andWhere("products.branch_id = :branchId", { branchId });
        }

        baseQuery = addFilterCondition(baseQuery, category_id, "category_id", "products");
        baseQuery = addBooleanFilter(baseQuery, is_active, "is_active", "products");
        baseQuery = addSearchCondition(baseQuery, q, ["display_name", "description"], "products");

        const total = await baseQuery.clone().getCount();
        const ids = await baseQuery
            .clone()
            .select("products.id", "id")
            .orderBy("products.create_date", createdSortToOrder(sortCreated))
            .skip((page - 1) * limit)
            .take(limit)
            .getRawMany<{ id: string }>();
        const data = await this.loadByIds(
            ids.map((item) => item.id),
            branchId,
            sortCreated,
        );

        const last_page = Math.ceil(total / limit) || 1;
        return {
            data,
            total,
            page,
            last_page,
            has_next: page < last_page,
            has_prev: page > 1,
        };
    }

    async countActive(category_id?: string, branchId?: string): Promise<number> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "active-count", category_id);

        return withCache(
            key,
            async () => {
                const productsRepository = getRepository(Products);
                let baseQuery = productsRepository
                    .createQueryBuilder("products")
                    .where("products.is_active = :isActive", { isActive: true });

                if (branchId) {
                    baseQuery.andWhere("products.branch_id = :branchId", { branchId });
                }

                baseQuery = addFilterCondition(baseQuery, category_id, "category_id", "products");
                return baseQuery.getCount();
            },
            2 * 60 * 1000,
            queryCache as any,
        );
    }

    async findOne(id: string, branchId?: string): Promise<Products | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => {
                const productsRepository = getRepository(Products);
                const query = productsRepository
                    .createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .leftJoinAndSelect("products.topping_groups", "topping_group")
                    .where("products.id = :id", { id });

                if (branchId) {
                    query.andWhere("products.branch_id = :branchId", { branchId });
                }

                return query.getOne();
            },
            this.CACHE_TTL,
            queryCache as any,
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<Products | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => {
                const productsRepository = getRepository(Products);
                const query = productsRepository
                    .createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .leftJoinAndSelect("products.topping_groups", "topping_group")
                    .where("LOWER(TRIM(products.display_name)) = :name", { name: normalizedName });

                if (branchId) {
                    query.andWhere("products.branch_id = :branchId", { branchId });
                }

                return query.getOne();
            },
            this.CACHE_TTL,
            queryCache as any,
        );
    }

    async create(data: Products): Promise<Products> {
        const productsRepository = getRepository(Products);
        const entity = productsRepository.create(data);
        const saved = await productsRepository.save(entity);

        this.invalidateProductCache(data.branch_id, saved.id);
        return saved;
    }

    async update(id: string, data: Partial<Products>, branchId?: string): Promise<Products> {
        const productsRepository = getRepository(Products);
        const existing = await this.findOne(id, branchId);
        if (!existing) {
            throw new Error("Product not found");
        }

        productsRepository.merge(existing, data);
        const saved = await productsRepository.save(existing);

        this.invalidateProductCache(branchId ?? data.branch_id, id);
        return saved;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const productsRepository = getRepository(Products);
        await productsRepository
            .createQueryBuilder("products")
            .delete()
            .where("products.id = :id", { id })
            .andWhere(branchId ? "products.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
            .execute();

        this.invalidateProductCache(branchId, id);
    }

    private invalidateProductCache(branchId?: string, id?: string): void {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;

        if (!effectiveBranchId) {
            invalidateCache([`${this.CACHE_PREFIX}:`]);
            return;
        }

        const scopes: Array<Array<string>> = [
            ["branch", effectiveBranchId],
            ["admin"],
            ["public"],
        ];
        const patterns: string[] = [];

        for (const scope of scopes) {
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "name"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "active-count"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "count-by-category"));
            if (id) {
                patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single", id));
            }
        }

        invalidateCache(patterns);
    }

    async countByCategory(): Promise<Array<{ category_id: string; count: number }>> {
        const scope = this.getCacheScopeParts();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "count-by-category");

        return withCache(
            key,
            () =>
                getRepository(Products)
                    .createQueryBuilder("products")
                    .select("products.category_id", "category_id")
                    .addSelect("COUNT(*)", "count")
                    .groupBy("products.category_id")
                    .getRawMany(),
            5 * 60 * 1000,
            queryCache as any,
        );
    }
}
