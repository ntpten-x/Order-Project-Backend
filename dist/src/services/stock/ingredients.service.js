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
exports.IngredientsService = void 0;
const socket_service_1 = require("../socket.service");
const cache_1 = require("../../utils/cache");
const dbContext_1 = require("../../database/dbContext");
/**
 * Ingredients Service with Caching
 * Following supabase-postgres-best-practices: server-cache-lru
 * Branch-based data isolation supported
 */
class IngredientsService {
    constructor(ingredientsModel) {
        this.ingredientsModel = ingredientsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
        this.CACHE_PREFIX = 'ingredients';
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
    findAll(filters, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'list', JSON.stringify(filters || {}));
            return (0, cache_1.withCache)(key, () => this.ingredientsModel.findAll(filters, branchId), this.CACHE_TTL, cache_1.metadataCache);
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'single', id);
            return (0, cache_1.withCache)(key, () => this.ingredientsModel.findOne(id, branchId), this.CACHE_TTL, cache_1.metadataCache);
        });
    }
    findOneByName(ingredient_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'name', ingredient_name);
            return (0, cache_1.withCache)(key, () => this.ingredientsModel.findOneByName(ingredient_name, branchId), this.CACHE_TTL, cache_1.metadataCache);
        });
    }
    create(ingredients) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check for duplicate name within the same branch
            if (ingredients.ingredient_name && ingredients.branch_id) {
                const existing = yield this.ingredientsModel.findOneByName(ingredients.ingredient_name, ingredients.branch_id);
                if (existing) {
                    throw new Error("ชื่อวัตถุดิบนี้มีอยู่ในระบบแล้ว");
                }
            }
            const savedIngredients = yield this.ingredientsModel.create(ingredients);
            const createdIngredients = yield this.ingredientsModel.findOne(savedIngredients.id);
            if (createdIngredients) {
                // Invalidate cache
                this.invalidateCache(createdIngredients.branch_id);
                if (createdIngredients.branch_id) {
                    this.socketService.emitToBranch(createdIngredients.branch_id, 'ingredients:create', createdIngredients);
                }
                return createdIngredients;
            }
            return savedIngredients;
        });
    }
    update(id, ingredients, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.ingredientsModel.findOne(id, branchId);
            if (!existing)
                throw new Error("Ingredient not found");
            const effectiveBranchId = branchId || existing.branch_id || ingredients.branch_id;
            if (effectiveBranchId) {
                ingredients.branch_id = effectiveBranchId;
            }
            yield this.ingredientsModel.update(id, ingredients, effectiveBranchId);
            const updatedIngredients = yield this.ingredientsModel.findOne(id, effectiveBranchId);
            if (updatedIngredients) {
                // Invalidate cache
                this.invalidateCache(effectiveBranchId, id);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, 'ingredients:update', updatedIngredients);
                }
                return updatedIngredients;
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตวัตถุดิบ");
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.ingredientsModel.findOne(id, branchId);
            if (!existing)
                throw new Error("Ingredient not found");
            const effectiveBranchId = branchId || existing.branch_id;
            yield this.ingredientsModel.delete(id, effectiveBranchId);
            // Invalidate cache
            this.invalidateCache(effectiveBranchId, id);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'ingredients:delete', { id });
            }
        });
    }
    /**
     * Invalidate ingredients cache
     */
    invalidateCache(branchId, id) {
        const ctx = (0, dbContext_1.getDbContext)();
        const effectiveBranchId = branchId !== null && branchId !== void 0 ? branchId : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
        if (!effectiveBranchId) {
            (0, cache_1.invalidateCache)([`${this.CACHE_PREFIX}:`]);
            return;
        }
        const patterns = [
            (0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", effectiveBranchId, "list"),
            (0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", effectiveBranchId, "name"),
        ];
        if (id) {
            patterns.push((0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
        }
        (0, cache_1.invalidateCache)(patterns);
    }
}
exports.IngredientsService = IngredientsService;
