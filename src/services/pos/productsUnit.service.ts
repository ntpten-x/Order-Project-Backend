import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { SocketService } from "../socket.service";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { Products } from "../../entity/pos/Products";
import { getDbContext, getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { AppError } from "../../utils/AppError";
import { cacheKey, invalidateCache, queryCache, withCache } from "../../utils/cache";

export class ProductsUnitService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = "products-unit";
    private readonly CACHE_TTL = Number(process.env.POS_MASTER_CACHE_TTL_MS || 30_000);

    constructor(private productsUnitModel: ProductsUnitModels) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private getInvalidationPatterns(branchId?: string, id?: string): string[] {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;

        if (!effectiveBranchId) {
            return [`${this.CACHE_PREFIX}:`];
        }

        const scopes: Array<Array<string>> = [
            ["branch", effectiveBranchId],
            ["admin"],
            ["public"],
        ];
        const patterns: string[] = [];

        for (const scope of scopes) {
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "list-all"));
            patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "name"));
            if (id) {
                patterns.push(cacheKey(this.CACHE_PREFIX, ...scope, "single", id));
            }
        }

        return patterns;
    }

    private invalidateProductsUnitCache(branchId?: string, id?: string): void {
        invalidateCache(this.getInvalidationPatterns(branchId, id));
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<ProductsUnit[]> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list-all", sortCreated);

        return withCache(
            key,
            () => this.productsUnitModel.findAll(branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: ProductsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(
            this.CACHE_PREFIX,
            ...scope,
            "list",
            page,
            limit,
            sortCreated,
            (filters?.q || "").trim().toLowerCase(),
            filters?.status || "all"
        );

        return withCache(
            key,
            () => this.productsUnitModel.findAllPaginated(page, limit, filters, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOne(id: string, branchId?: string): Promise<ProductsUnit | null> {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "single", id);

        return withCache(
            key,
            () => this.productsUnitModel.findOne(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async findOneByName(name: string, branchId?: string): Promise<ProductsUnit | null> {
        const scope = this.getCacheScopeParts(branchId);
        const normalizedName = name.trim().toLowerCase();
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "name", normalizedName);

        return withCache(
            key,
            () => this.productsUnitModel.findOneByName(name, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async create(productsUnit: ProductsUnit, branchId?: string): Promise<ProductsUnit> {
        const effectiveBranchId = branchId || productsUnit.branch_id;
        const displayName = productsUnit.display_name?.trim();

        if (!displayName) {
            throw AppError.badRequest("Products unit name is required");
        }

        productsUnit.display_name = displayName;
        if (effectiveBranchId) {
            productsUnit.branch_id = effectiveBranchId;
        }

        const existingUnit = await this.productsUnitModel.findOneByName(displayName, effectiveBranchId);
        if (existingUnit) {
            throw AppError.conflict("Products unit name already exists");
        }

        const createdProductsUnit = await this.productsUnitModel.create(productsUnit);
        this.invalidateProductsUnitCache(effectiveBranchId, createdProductsUnit.id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.create, createdProductsUnit);
        }
        return createdProductsUnit;
    }

    async update(id: string, productsUnit: ProductsUnit, branchId?: string): Promise<ProductsUnit> {
        const effectiveBranchId = branchId || productsUnit.branch_id;
        const existingUnit = await this.productsUnitModel.findOne(id, effectiveBranchId);
        if (!existingUnit) {
            throw AppError.notFound("Products unit");
        }

        if (productsUnit.display_name !== undefined) {
            productsUnit.display_name = productsUnit.display_name.trim();
            if (!productsUnit.display_name) {
                throw AppError.badRequest("Products unit name is required");
            }
        }

        const normalizedIncomingName = productsUnit.display_name?.trim().toLowerCase();
        const normalizedCurrentName = existingUnit.display_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const foundProductsUnit = await this.productsUnitModel.findOneByName(productsUnit.display_name!, effectiveBranchId);
            if (foundProductsUnit && foundProductsUnit.id !== id) {
                throw AppError.conflict("Products unit name already exists");
            }
        }

        if (effectiveBranchId) {
            productsUnit.branch_id = effectiveBranchId;
        }

        const updatedProductsUnit = await this.productsUnitModel.update(id, productsUnit, effectiveBranchId);
        this.invalidateProductsUnitCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.update, updatedProductsUnit);
        }
        return updatedProductsUnit;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.productsUnitModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Products unit");
        }

        const effectiveBranchId = branchId || existing.branch_id;
        const productCount = await getRepository(Products).count({
            where: effectiveBranchId
                ? ({ unit_id: id, branch_id: effectiveBranchId } as any)
                : ({ unit_id: id } as any),
        });

        if (productCount > 0) {
            throw AppError.conflict("Products unit cannot be deleted because it is referenced by products");
        }

        await this.productsUnitModel.delete(id, effectiveBranchId);
        this.invalidateProductsUnitCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.delete, { id });
        }
    }
}
