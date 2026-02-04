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
exports.IngredientsUnitService = void 0;
const socket_service_1 = require("../socket.service");
class IngredientsUnitService {
    constructor(ingredientsUnitModel) {
        this.ingredientsUnitModel = ingredientsUnitModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(filters, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitModel.findAll(filters, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByUnitName(unit_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ingredientsUnitModel.findOneByUnitName(unit_name, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ingredientsUnit, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const effectiveBranchId = branchId || ingredientsUnit.branch_id;
                if (effectiveBranchId) {
                    ingredientsUnit.branch_id = effectiveBranchId;
                }
                // Check for duplicate name within the same branch
                if (ingredientsUnit.unit_name && effectiveBranchId) {
                    const existing = yield this.ingredientsUnitModel.findOneByUnitName(ingredientsUnit.unit_name, effectiveBranchId);
                    if (existing) {
                        throw new Error("ชื่อหน่วยนับนี้มีอยู่ในระบบแล้ว");
                    }
                }
                // @ts-ignore - model returns {id} essentially
                const savedIngredientsUnit = yield this.ingredientsUnitModel.create(ingredientsUnit);
                const createdIngredientsUnit = yield this.ingredientsUnitModel.findOne(savedIngredientsUnit.id, effectiveBranchId);
                if (createdIngredientsUnit) {
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'ingredientsUnit:create', createdIngredientsUnit);
                    }
                    return createdIngredientsUnit;
                }
                return savedIngredientsUnit;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ingredientsUnit, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.ingredientsUnitModel.findOne(id, branchId);
                if (!existing)
                    throw new Error("Ingredients unit not found");
                const effectiveBranchId = branchId || existing.branch_id || ingredientsUnit.branch_id;
                if (effectiveBranchId) {
                    ingredientsUnit.branch_id = effectiveBranchId;
                }
                yield this.ingredientsUnitModel.update(id, ingredientsUnit, effectiveBranchId);
                const updatedIngredientsUnit = yield this.ingredientsUnitModel.findOne(id, effectiveBranchId);
                if (updatedIngredientsUnit) {
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'ingredientsUnit:update', updatedIngredientsUnit);
                    }
                    return updatedIngredientsUnit;
                }
                throw new Error("พบข้อผิดพลาดในการอัปเดตหน่วยนับวัตถุดิบ");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.ingredientsUnitModel.findOne(id, branchId);
                if (!existing)
                    throw new Error("Ingredients unit not found");
                const effectiveBranchId = branchId || existing.branch_id;
                yield this.ingredientsUnitModel.delete(id, effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, 'ingredientsUnit:delete', { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.IngredientsUnitService = IngredientsUnitService;
