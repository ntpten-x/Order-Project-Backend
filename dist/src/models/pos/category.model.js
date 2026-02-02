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
exports.CategoryModels = void 0;
const database_1 = require("../../database/database");
const Category_1 = require("../../entity/pos/Category");
class CategoryModels {
    constructor() {
        this.categoryRepository = database_1.AppDataSource.getRepository(Category_1.Category);
    }
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.categoryRepository.createQueryBuilder("category")
                    .orderBy("category.create_date", "ASC");
                if (branchId) {
                    query.andWhere("category.branch_id = :branchId", { branchId });
                }
                return query.getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.categoryRepository.createQueryBuilder("category")
                    .where("category.id = :id", { id });
                if (branchId) {
                    query.andWhere("category.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(category_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const query = this.categoryRepository.createQueryBuilder("category")
                    .where("category.category_name = :category_name", { category_name });
                if (branchId) {
                    query.andWhere("category.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryRepository.createQueryBuilder("category").insert().values(data).returning("id").execute().then((result) => result.raw[0]);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryRepository.createQueryBuilder("category").update(data).where("category.id = :id", { id }).returning("id").execute().then((result) => result.raw[0]);
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.categoryRepository.createQueryBuilder("category").delete().where("category.id = :id", { id }).execute();
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.CategoryModels = CategoryModels;
