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
exports.IngredientsUnitModel = void 0;
const database_1 = require("../database/database");
const IngredientsUnit_1 = require("../entity/IngredientsUnit");
class IngredientsUnitModel {
    constructor() {
        this.ingredientsUnitRepository = database_1.AppDataSource.getRepository(IngredientsUnit_1.IngredientsUnit);
    }
    findAll(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                    // .leftJoinAndSelect("ingredientsUnit.ingredients", "ingredients")
                    .orderBy("ingredientsUnit.create_date", "ASC");
                if ((filters === null || filters === void 0 ? void 0 : filters.is_active) !== undefined) {
                    query.andWhere("ingredientsUnit.is_active = :is_active", { is_active: filters.is_active });
                }
                // Secondary sort
                query.addOrderBy("ingredientsUnit.is_active", "DESC");
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
                return this.ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                    // .leftJoinAndSelect("ingredientsUnit.ingredients", "ingredients")
                    .where("ingredientsUnit.id = :id", { id })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByUnitName(unit_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                    // .leftJoinAndSelect("ingredientsUnit.ingredients", "ingredients")
                    .where("ingredientsUnit.unit_name = :unit_name", { unit_name })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ingredientsUnit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitRepository.save(ingredientsUnit);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ingredientsUnit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitRepository.save(Object.assign(Object.assign({}, ingredientsUnit), { id }));
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ingredientsUnitRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.IngredientsUnitModel = IngredientsUnitModel;
