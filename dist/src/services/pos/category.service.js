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
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(category_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.categoryModel.findOneByName(category_name);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(category) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const savedCategory = yield this.categoryModel.create(category);
                const createdCategory = yield this.categoryModel.findOne(savedCategory.id);
                if (createdCategory) {
                    this.socketService.emit('category:create', createdCategory);
                    return createdCategory;
                }
                return savedCategory;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, category) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.categoryModel.update(id, category);
                const updatedCategory = yield this.categoryModel.findOne(id);
                if (updatedCategory) {
                    this.socketService.emit('category:update', updatedCategory);
                    return updatedCategory;
                }
                throw new Error("พบข้อผิดพลาดในการอัปเดตหมวดหมู่สินค้า");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.categoryModel.delete(id);
                this.socketService.emit('category:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.CategoryService = CategoryService;
