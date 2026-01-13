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
exports.OrdersDetailModels = void 0;
const database_1 = require("../../database/database");
const OrdersDetail_1 = require("../../entity/pos/OrdersDetail");
class OrdersDetailModels {
    constructor() {
        this.ordersDetailRepository = database_1.AppDataSource.getRepository(OrdersDetail_1.OrdersDetail);
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersDetailRepository.find({
                    order: {
                        create_date: "ASC"
                    },
                    relations: ["orders_item"]
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
                return this.ordersDetailRepository.findOne({
                    where: { id },
                    relations: ["orders_item"]
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
                return this.ordersDetailRepository.save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersDetailRepository.update(id, data);
                const updatedDetail = yield this.findOne(id);
                if (!updatedDetail) {
                    throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมของสินค้าที่ต้องการค้นหา");
                }
                return updatedDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersDetailRepository.delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersDetailModels = OrdersDetailModels;
