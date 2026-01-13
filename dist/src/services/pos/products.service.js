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
class ProductsService {
    constructor(productsModel) {
        this.productsModel = productsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(product_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.productsModel.findOneByName(product_name);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(products) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // @ts-ignore
                const savedProducts = yield this.productsModel.create(products);
                const createdProducts = yield this.productsModel.findOne(savedProducts.id);
                if (createdProducts) {
                    this.socketService.emit('products:create', createdProducts);
                    return createdProducts;
                }
                return savedProducts;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, products) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productsModel.update(id, products);
                const updatedProducts = yield this.productsModel.findOne(id);
                if (updatedProducts) {
                    this.socketService.emit('products:update', updatedProducts);
                    return updatedProducts;
                }
                throw new Error("พบข้อผิดพลาดในการอัปเดตสินค้า");
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.productsModel.delete(id);
                this.socketService.emit('products:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ProductsService = ProductsService;
