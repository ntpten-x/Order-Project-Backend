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
exports.SalesOrderDetailModels = void 0;
const SalesOrderDetail_1 = require("../../entity/pos/SalesOrderDetail");
const dbContext_1 = require("../../database/dbContext");
class SalesOrderDetailModels {
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const salesOrderDetailRepository = (0, dbContext_1.getRepository)(SalesOrderDetail_1.SalesOrderDetail);
                const query = salesOrderDetailRepository
                    .createQueryBuilder("detail")
                    .leftJoinAndSelect("detail.sales_order_item", "item")
                    .leftJoinAndSelect("item.order", "order")
                    .orderBy("detail.create_date", "ASC");
                if (branchId) {
                    query.andWhere("order.branch_id = :branchId", { branchId });
                }
                return query.getMany();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const salesOrderDetailRepository = (0, dbContext_1.getRepository)(SalesOrderDetail_1.SalesOrderDetail);
                const query = salesOrderDetailRepository
                    .createQueryBuilder("detail")
                    .leftJoinAndSelect("detail.sales_order_item", "item")
                    .leftJoinAndSelect("item.order", "order")
                    .where("detail.id = :id", { id });
                if (branchId) {
                    query.andWhere("order.branch_id = :branchId", { branchId });
                }
                return query.getOne();
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (0, dbContext_1.getRepository)(SalesOrderDetail_1.SalesOrderDetail).save(data);
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, data, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (branchId) {
                    const existing = yield this.findOne(id, branchId);
                    if (!existing)
                        throw new Error("Detail not found");
                }
                yield (0, dbContext_1.getRepository)(SalesOrderDetail_1.SalesOrderDetail).update(id, data);
                const updatedDetail = yield this.findOne(id, branchId);
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
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (branchId) {
                    const existing = yield this.findOne(id, branchId);
                    if (!existing)
                        throw new Error("Detail not found");
                }
                yield (0, dbContext_1.getRepository)(SalesOrderDetail_1.SalesOrderDetail).delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderDetailModels = SalesOrderDetailModels;
