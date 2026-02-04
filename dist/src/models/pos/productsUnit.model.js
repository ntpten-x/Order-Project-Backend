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
const ProductsUnit_1 = require("../../entity/pos/ProductsUnit");
const dbContext_1 = require("../../database/dbContext");
class ProductsUnitModels {
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const productsUnitRepository = (0, dbContext_1.getRepository)(ProductsUnit_1.ProductsUnit);
                const where = {};
                if (branchId) {
                    where.branch_id = branchId;
                }
                return productsUnitRepository.find({
                    where,
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
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const productsUnitRepository = (0, dbContext_1.getRepository)(ProductsUnit_1.ProductsUnit);
                const where = { id };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return productsUnitRepository.findOne({
                    where
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const productsUnitRepository = (0, dbContext_1.getRepository)(ProductsUnit_1.ProductsUnit);
                const where = { unit_name: name };
                if (branchId) {
                    where.branch_id = branchId;
                }
                return productsUnitRepository.findOne({
                    where
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
                const productsUnitRepository = (0, dbContext_1.getRepository)(ProductsUnit_1.ProductsUnit);
                const entity = productsUnitRepository.create(data);
                return productsUnitRepository.save(entity);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const productsUnitRepository = (0, dbContext_1.getRepository)(ProductsUnit_1.ProductsUnit);
                if (branchId) {
                    yield productsUnitRepository.update({ id, branch_id: branchId }, data);
                }
                else {
                    yield productsUnitRepository.update(id, data);
                }
                return this.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const productsUnitRepository = (0, dbContext_1.getRepository)(ProductsUnit_1.ProductsUnit);
                if (branchId) {
                    yield productsUnitRepository.delete({ id, branch_id: branchId });
                }
                else {
                    yield productsUnitRepository.delete(id);
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ProductsUnitModels = ProductsUnitModels;
