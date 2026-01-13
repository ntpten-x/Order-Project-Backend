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
exports.OrdersModels = void 0;
const database_1 = require("../../database/database");
const Orders_1 = require("../../entity/pos/Orders");
class OrdersModels {
    constructor() {
        this.ordersRepository = database_1.AppDataSource.getRepository(Orders_1.Orders);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersRepository.find({
                    order: {
                        create_date: "DESC"
                    },
                    relations: ["table", "delivery", "discount", "created_by"]
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
                return this.ordersRepository.findOne({
                    where: { id },
                    relations: ["table", "delivery", "discount", "created_by", "items", "items.product", "items.details", "payments"]
                });
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByOrderNo(order_no) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersRepository.findOne({
                    where: { order_no },
                    relations: ["table", "delivery", "discount", "created_by"]
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
                return this.ordersRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersRepository.update(id, data);
                const updatedOrder = yield this.findOne(id);
                if (!updatedOrder) {
                    throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการค้นหา");
                }
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersModels = OrdersModels;
