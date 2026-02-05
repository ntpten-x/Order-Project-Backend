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
exports.SalesOrderDetailService = void 0;
const socket_service_1 = require("../socket.service");
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const orderTotals_service_1 = require("./orderTotals.service");
const dbContext_1 = require("../../database/dbContext");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
class SalesOrderDetailService {
    constructor(salesOrderDetailModel) {
        this.salesOrderDetailModel = salesOrderDetailModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    recalcByItemId(ordersItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!ordersItemId)
                return;
            const itemRepo = (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
            const item = yield itemRepo.findOneBy({ id: ordersItemId });
            if (item) {
                yield (0, orderTotals_service_1.recalculateOrderTotal)(item.order_id);
            }
        });
    }
    findAll(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderDetailModel.findAll(branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderDetailModel.findOne(id, branchId);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(salesOrderDetail, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!salesOrderDetail.orders_item_id) {
                    throw new Error("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธฃเธซเธฑเธชเธฃเธฒเธขเธเธฒเธฃเธชเธดเธเธเนเธฒเนเธกเนเธเนเธฒเธข");
                }
                if (branchId) {
                    const itemRepo = (0, dbContext_1.getRepository)(SalesOrderItem_1.SalesOrderItem);
                    const item = yield itemRepo
                        .createQueryBuilder("item")
                        .innerJoin("item.order", "order")
                        .where("item.id = :id", { id: salesOrderDetail.orders_item_id })
                        .andWhere("order.branch_id = :branchId", { branchId })
                        .getOne();
                    if (!item) {
                        throw new Error("Order item not found for this branch");
                    }
                }
                const createdDetail = yield this.salesOrderDetailModel.create(salesOrderDetail);
                yield this.recalcByItemId(createdDetail.orders_item_id);
                const completeDetail = yield this.salesOrderDetailModel.findOne(createdDetail.id, branchId);
                if (completeDetail) {
                    if (branchId) {
                        this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.salesOrderDetail.create, completeDetail);
                    }
                    return completeDetail;
                }
                return createdDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, salesOrderDetail, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const detailToUpdate = yield this.salesOrderDetailModel.findOne(id, branchId);
                if (!detailToUpdate) {
                    throw new Error("ไม่พบรายละเอียดเพิ่มเติมที่ต้องการแก้ไข");
                }
                const updatedDetail = yield this.salesOrderDetailModel.update(id, salesOrderDetail, branchId);
                yield this.recalcByItemId(detailToUpdate.orders_item_id);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.salesOrderDetail.update, updatedDetail);
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
                const detailToDelete = yield this.salesOrderDetailModel.findOne(id, branchId);
                yield this.salesOrderDetailModel.delete(id, branchId);
                yield this.recalcByItemId(detailToDelete === null || detailToDelete === void 0 ? void 0 : detailToDelete.orders_item_id);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, realtimeEvents_1.RealtimeEvents.salesOrderDetail.delete, { id });
                }
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderDetailService = SalesOrderDetailService;
