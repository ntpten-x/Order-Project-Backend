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
exports.SalesOrderItemService = void 0;
const socket_service_1 = require("../socket.service");
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const dbContext_1 = require("../../database/dbContext");
class SalesOrderItemService {
    constructor(salesOrderItemModel) {
        this.salesOrderItemModel = salesOrderItemModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderItemModel.findAll(branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderItemModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(salesOrderItem, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!salesOrderItem.order_id) {
                    throw new Error("กรุณาระบุรหัสออเดอร์");
                }
                if (!salesOrderItem.product_id) {
                    throw new Error("กรุณาระบุรหัสสินค้า");
                }
                if (branchId) {
                    const orderRepo = (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
                    const order = yield orderRepo.findOneBy({ id: salesOrderItem.order_id, branch_id: branchId });
                    if (!order) {
                        throw new Error("Order not found for this branch");
                    }
                }
                const createdItem = yield this.salesOrderItemModel.create(salesOrderItem);
                const completeItem = yield this.salesOrderItemModel.findOne(createdItem.id, branchId);
                if (completeItem) {
                    if (branchId) {
                        this.socketService.emitToBranch(branchId, 'salesOrderItem:create', completeItem);
                    }
                    return completeItem;
                }
                return createdItem;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, salesOrderItem, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const itemToUpdate = yield this.salesOrderItemModel.findOne(id, branchId);
                if (!itemToUpdate) {
                    throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข");
                }
                const updatedItem = yield this.salesOrderItemModel.update(id, salesOrderItem, branchId);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, 'salesOrderItem:update', updatedItem);
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
                yield this.salesOrderItemModel.delete(id, branchId);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, 'salesOrderItem:delete', { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderItemService = SalesOrderItemService;
