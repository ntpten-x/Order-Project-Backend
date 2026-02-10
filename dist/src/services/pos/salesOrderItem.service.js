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
const realtimeEvents_1 = require("../../utils/realtimeEvents");
const orderTotals_service_1 = require("./orderTotals.service");
const orderStatus_1 = require("../../utils/orderStatus");
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
                // Normalize legacy status values (e.g. 'cancelled') to canonical casing on write.
                if (salesOrderItem.status !== undefined) {
                    salesOrderItem.status = (0, orderStatus_1.normalizeOrderStatus)(salesOrderItem.status);
                }
                const createdItem = yield this.salesOrderItemModel.create(salesOrderItem);
                // Keep order totals consistent even if this endpoint is used directly.
                yield (0, orderTotals_service_1.recalculateOrderTotal)(createdItem.order_id);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.orders.update, { id: createdItem.order_id });
                }
                const completeItem = yield this.salesOrderItemModel.findOne(createdItem.id, branchId);
                if (completeItem) {
                    if (branchId) {
                        this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.salesOrderItem.create, completeItem);
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
                if (salesOrderItem.status !== undefined) {
                    salesOrderItem.status = (0, orderStatus_1.normalizeOrderStatus)(salesOrderItem.status);
                }
                const updatedItem = yield this.salesOrderItemModel.update(id, salesOrderItem, branchId);
                yield (0, orderTotals_service_1.recalculateOrderTotal)(itemToUpdate.order_id);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.orders.update, { id: itemToUpdate.order_id });
                }
                if (branchId) {
                    this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.salesOrderItem.update, updatedItem);
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
                const item = yield this.salesOrderItemModel.findOne(id, branchId);
                yield this.salesOrderItemModel.delete(id, branchId);
                if (item === null || item === void 0 ? void 0 : item.order_id) {
                    yield (0, orderTotals_service_1.recalculateOrderTotal)(item.order_id);
                    if (branchId) {
                        this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.orders.update, { id: item.order_id });
                    }
                }
                if (branchId) {
                    this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.salesOrderItem.delete, { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderItemService = SalesOrderItemService;
