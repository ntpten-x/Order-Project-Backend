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
const database_1 = require("../database/database");
const Ingredients_1 = require("../entity/Ingredients");
class IngredientsModel {
    constructor() {
        this.ingredientsRepository = database_1.AppDataSource.getRepository(Ingredients_1.Ingredients);
    }
    findAll(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.ingredientsRepository.createQueryBuilder("ingredients")
                    .leftJoinAndSelect("ingredients.unit", "unit")
                    .orderBy("ingredients.create_date", "ASC");
                if ((filters === null || filters === void 0 ? void 0 : filters.is_active) !== undefined) {
                    query.andWhere("ingredients.is_active = :is_active", { is_active: filters.is_active });
                }
                // Secondary sort for consistent ordering when active ones are mixed
                query.addOrderBy("ingredients.is_active", "DESC");
                return query.getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsRepository.createQueryBuilder("ingredients")
                    .leftJoinAndSelect("ingredients.unit", "unit")
                    .where("ingredients.id = :id", { id })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(ingredient_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsRepository.createQueryBuilder("ingredients")
                    .leftJoinAndSelect("ingredients.unit", "unit")
                    .where("ingredients.ingredient_name = :ingredient_name", { ingredient_name })
                    .getOne();
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
