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
class ProductsModels {
    constructor() {
        this.productsRepository = database_1.AppDataSource.getRepository(Products_1.Products);
    }
    findAll() {
        return __awaiter(this, arguments, void 0, function* (page = 1, limit = 50, category_id, q) {
            try {
                const skip = (page - 1) * limit;
                const query = this.productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .orderBy("products.create_date", "ASC");
                if (category_id) {
                    query.andWhere("products.category_id = :category_id", { category_id });
                }
                if (q && q.trim()) {
                    query.andWhere("(products.product_name ILIKE :q OR products.display_name ILIKE :q OR products.description ILIKE :q)", { q: `%${q.trim()}%` });
                }
                const [data, total] = yield query.skip(skip).take(limit).getManyAndCount();
                return {
                    data,
                    total,
                    page,
                    last_page: Math.ceil(total / limit) || 1
                };
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .where("products.id = :id", { id })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(product_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsRepository.createQueryBuilder("products")
                    .leftJoinAndSelect("products.category", "category")
                    .leftJoinAndSelect("products.unit", "unit")
                    .where("products.product_name = :product_name", { product_name })
                    .getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsRepository.createQueryBuilder("products").insert().values(data).returning("id").execute().then((result) => result.raw[0]);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsRepository.createQueryBuilder("products").update(data).where("products.id = :id", { id }).returning("id").execute().then((result) => result.raw[0]);
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.productsRepository.createQueryBuilder("products").delete().where("products.id = :id", { id }).execute();
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ProductsModels = ProductsModels;
