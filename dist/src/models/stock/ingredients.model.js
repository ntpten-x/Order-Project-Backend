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
exports.IngredientsModel = void 0;
const database_1 = require("../../database/database");
const Ingredients_1 = require("../../entity/stock/Ingredients");
const dbHelpers_1 = require("../../utils/dbHelpers");
/**
 * Ingredients Model
 * Following supabase-postgres-best-practices:
 * - Uses dbHelpers for consistent query patterns
 * - Optimized queries with proper joins
 * - Branch-based data isolation support
 */
class IngredientsModel {
    constructor() {
        this.ingredientsRepository = database_1.AppDataSource.getRepository(Ingredients_1.Ingredients);
    }
    findAll(filters, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = this.ingredientsRepository.createQueryBuilder("ingredients")
                .leftJoinAndSelect("ingredients.unit", "unit")
                .orderBy("ingredients.create_date", "ASC");
            // Filter by branch for data isolation
            if (branchId) {
                query.andWhere("ingredients.branch_id = :branchId", { branchId });
            }
            // Use dbHelpers for consistent filtering
            query = (0, dbHelpers_1.addBooleanFilter)(query, filters === null || filters === void 0 ? void 0 : filters.is_active, "is_active", "ingredients");
            // Secondary sort for consistent ordering when active ones are mixed
            query.addOrderBy("ingredients.is_active", "DESC");
            return query.getMany();
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.ingredientsRepository.createQueryBuilder("ingredients")
                    .leftJoinAndSelect("ingredients.unit", "unit")
                    .where("ingredients.id = :id", { id });
                if (branchId) {
                    query.andWhere("ingredients.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(ingredient_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.ingredientsRepository.createQueryBuilder("ingredients")
                    .leftJoinAndSelect("ingredients.unit", "unit")
                    .where("ingredients.ingredient_name = :ingredient_name", { ingredient_name });
                if (branchId) {
                    query.andWhere("ingredients.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ingredients) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsRepository.save(ingredients);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ingredients) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsRepository.save(Object.assign(Object.assign({}, ingredients), { id }));
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ingredientsRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.IngredientsModel = IngredientsModel;
