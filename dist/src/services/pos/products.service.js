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
exports.ProductsService = void 0;
const socket_service_1 = require("../socket.service");
const AppError_1 = require("../../utils/AppError");
/**
 * Products Service
 * Note: Caching is handled in ProductsModel
 * This service handles cache invalidation on mutations
 * Branch-based data isolation supported
 */
class ProductsService {
    constructor(productsModel) {
        this.productsModel = productsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
        this.CACHE_PREFIX = 'products';
    }
    findAll(page, limit, category_id, q, is_active, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Caching is handled in ProductsModel
            return this.productsModel.findAll(page, limit, category_id, q, is_active, branchId);
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Caching is handled in ProductsModel
            return this.productsModel.findOne(id, branchId);
        });
    }
    findOneByName(product_name, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Caching is handled in ProductsModel
            return this.productsModel.findOneByName(product_name, branchId);
        });
    }
    create(products) {
        return __awaiter(this, void 0, void 0, function* () {
            const savedProducts = yield this.productsModel.create(products);
            const createdProducts = yield this.productsModel.findOne(savedProducts.id, products.branch_id);
            if (createdProducts) {
                // Cache invalidation is handled in ProductsModel
                if (createdProducts.branch_id) {
                    this.socketService.emitToBranch(createdProducts.branch_id, 'products:create', createdProducts);
                }
                return createdProducts;
            }
            return savedProducts;
        });
    }
    update(id, products, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const effectiveBranchId = branchId || products.branch_id;
            yield this.productsModel.update(id, products, effectiveBranchId);
            const updatedProducts = yield this.productsModel.findOne(id, effectiveBranchId);
            if (updatedProducts) {
                // Cache invalidation is handled in ProductsModel
                const emitBranchId = updatedProducts.branch_id || effectiveBranchId;
                if (emitBranchId) {
                    this.socketService.emitToBranch(emitBranchId, 'products:update', updatedProducts);
                }
                return updatedProducts;
            }
            throw new AppError_1.AppError("พบข้อผิดพลาดในการอัปเดตสินค้า", 500);
        });
    }
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = yield this.productsModel.findOne(id, branchId);
            if (!existing) {
                throw new AppError_1.AppError("Product not found", 404);
            }
            yield this.productsModel.delete(id, branchId);
            // Cache invalidation is handled in ProductsModel
            const effectiveBranchId = existing.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'products:delete', { id });
            }
        });
    }
}
exports.ProductsService = ProductsService;
