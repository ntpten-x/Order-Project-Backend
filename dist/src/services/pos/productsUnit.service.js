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
exports.ProductsUnitService = void 0;
const socket_service_1 = require("../socket.service");
class ProductsUnitService {
    constructor(productsUnitModel) {
        this.productsUnitModel = productsUnitModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsUnitModel.findAll(branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsUnitModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(products_unit_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsUnitModel.findOneByName(products_unit_name, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(productsUnit, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const effectiveBranchId = branchId || productsUnit.branch_id;
                if (effectiveBranchId) {
                    productsUnit.branch_id = effectiveBranchId;
                }
                const findProductsUnit = yield this.productsUnitModel.findOneByName(productsUnit.unit_name, effectiveBranchId);
                if (findProductsUnit) {
                    throw new Error("หน่วยนี้มีอยู่ในระบบแล้ว");
                }
                // @ts-ignore
                const savedProductsUnit = yield this.productsUnitModel.create(productsUnit);
                const createdProductsUnit = yield this.productsUnitModel.findOne(savedProductsUnit.id, effectiveBranchId);
                if (createdProductsUnit) {
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'productsUnit:create', createdProductsUnit);
                    }
                    return createdProductsUnit;
                }
                return savedProductsUnit;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, productsUnit, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const effectiveBranchId = branchId || productsUnit.branch_id;
                if (effectiveBranchId) {
                    productsUnit.branch_id = effectiveBranchId;
                }
                const existingUnit = yield this.productsUnitModel.findOne(id, effectiveBranchId);
                if (!existingUnit) {
                    throw new Error("Products unit not found");
                }
                const findProductsUnit = yield this.productsUnitModel.findOneByName(productsUnit.unit_name, effectiveBranchId);
                if (findProductsUnit && findProductsUnit.id !== id) {
                    throw new Error("หน่วยนี้มีอยู่ในระบบแล้ว");
                }
                const updatedProductsUnit = yield this.productsUnitModel.update(id, productsUnit, effectiveBranchId);
                if (updatedProductsUnit) {
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'productsUnit:update', updatedProductsUnit);
                    }
                    return updatedProductsUnit;
                }
                throw new Error("ไม่สามารถอัปเดตข้อมูลได้");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.productsUnitModel.findOne(id, branchId);
                if (!existing)
                    throw new Error("Products unit not found");
                const effectiveBranchId = branchId || existing.branch_id;
                yield this.productsUnitModel.delete(id, effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, 'productsUnit:delete', { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ProductsUnitService = ProductsUnitService;
