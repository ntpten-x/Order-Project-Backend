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
exports.SalesOrderItemModels = void 0;
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const dbContext_1 = require("../../database/dbContext");
class SalesOrderItemModels {
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const salesOrderItemRepository = (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
                const query = salesOrderItemRepository
                    .createQueryBuilder("item")
                    .leftJoinAndSelect("item.order", "order")
                    .leftJoinAndSelect("item.product", "product")
                    .leftJoinAndSelect("item.details", "details")
                    .orderBy("item.id", "ASC");
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
                const salesOrderItemRepository = (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
                const query = salesOrderItemRepository
                    .createQueryBuilder("item")
                    .leftJoinAndSelect("item.order", "order")
                    .leftJoinAndSelect("item.product", "product")
                    .leftJoinAndSelect("item.details", "details")
                    .where("item.id = :id", { id });
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
                return (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem).save(data);
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
                    if (!existing) {
                        throw new Error("Item not found");
                    }
                }
                yield (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem).update(id, data);
                const updatedItem = yield this.findOne(id, branchId);
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
    delete(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (branchId) {
                    const existing = yield this.findOne(id, branchId);
                    if (!existing) {
                        throw new Error("Item not found");
                    }
                }
                yield (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem).delete(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderItemModels = SalesOrderItemModels;
