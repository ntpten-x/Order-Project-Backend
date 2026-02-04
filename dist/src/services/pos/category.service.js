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
exports.CategoryService = void 0;
const socket_service_1 = require("../socket.service");
class CategoryService {
    constructor(categoryModel) {
        this.categoryModel = categoryModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryModel.findAll(branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(category_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryModel.findOneByName(category_name, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(category) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check for duplicate name within the same branch
                if (category.category_name && category.branch_id) {
                    const existing = yield this.categoryModel.findOneByName(category.category_name, category.branch_id);
                    if (existing) {
                        throw new Error("ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว");
                    }
                }
                const savedCategory = yield this.categoryModel.create(category);
                const createdCategory = yield this.categoryModel.findOne(savedCategory.id, category.branch_id);
                if (createdCategory) {
                    if (createdCategory.branch_id) {
                        this.socketService.emitToBranch(createdCategory.branch_id, 'category:create', createdCategory);
                    }
                    return createdCategory;
                }
                return savedCategory;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, category, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.categoryModel.update(id, category, branchId || category.branch_id);
                const updatedCategory = yield this.categoryModel.findOne(id, branchId || category.branch_id);
                if (updatedCategory) {
                    const effectiveBranchId = updatedCategory.branch_id || branchId || category.branch_id;
                    if (effectiveBranchId) {
                        this.socketService.emitToBranch(effectiveBranchId, 'category:update', updatedCategory);
                    }
                    return updatedCategory;
                }
                throw new Error("พบข้อผิดพลาดในการอัปเดตหมวดหมู่สินค้า");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existing = yield this.categoryModel.findOne(id, branchId);
                if (!existing) {
                    throw new Error("Category not found");
                }
                yield this.categoryModel.delete(id, branchId);
                const effectiveBranchId = existing.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, 'category:delete', { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.CategoryService = CategoryService;
