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
exports.OrdersItemModels = void 0;
const database_1 = require("../../database/database");
const OrdersItem_1 = require("../../entity/pos/OrdersItem");
class OrdersItemModels {
    constructor() {
        this.ordersItemRepository = database_1.AppDataSource.getRepository(OrdersItem_1.OrdersItem);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersItemRepository.find({
                    order: {
                        id: "ASC"
                    },
                    relations: ["order", "product", "details"]
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
                return this.ordersItemRepository.findOne({
                    where: { id },
                    relations: ["order", "product", "details"]
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
                return this.ordersItemRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersItemRepository.update(id, data);
                const updatedItem = yield this.findOne(id);
                if (!updatedItem) {
                    throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการค้นหา");
                }
                return updatedItem;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersItemRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersItemModels = OrdersItemModels;
