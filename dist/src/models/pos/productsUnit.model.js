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
exports.ProductsUnitModels = void 0;
const database_1 = require("../../database/database");
const ProductsUnit_1 = require("../../entity/pos/ProductsUnit");
class ProductsUnitModels {
    constructor() {
        this.productsUnitRepository = database_1.AppDataSource.getRepository(ProductsUnit_1.ProductsUnit);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsUnitRepository.find({
                    order: {
                        create_date: "ASC"
                    }
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsUnitRepository.findOne({
                    where: { id }
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsUnitRepository.findOne({
                    where: { unit_name: name }
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const entity = this.productsUnitRepository.create(data);
                return this.productsUnitRepository.save(entity);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productsUnitRepository.update(id, data);
                return this.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productsUnitRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ProductsUnitModels = ProductsUnitModels;
