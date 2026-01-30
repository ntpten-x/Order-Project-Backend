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
const database_1 = require("../../database/database");
const SalesOrderItem_1 = require("../../entity/pos/SalesOrderItem");
const orderTotals_service_1 = require("./orderTotals.service");
class SalesOrderDetailService {
    constructor(salesOrderDetailModel) {
        this.salesOrderDetailModel = salesOrderDetailModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    recalcByItemId(ordersItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!ordersItemId)
                return;
            const itemRepo = database_1.AppDataSource.getRepository(SalesOrderItem_1.SalesOrderItem);
            const item = yield itemRepo.findOneBy({ id: ordersItemId });
            if (item) {
                yield (0, orderTotals_service_1.recalculateOrderTotal)(item.order_id);
            }
        });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderDetailModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderDetailModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(salesOrderDetail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!salesOrderDetail.orders_item_id) {
                    throw new Error("เธเธฃเธธเธ“เธฒเธฃเธฐเธเธธเธฃเธซเธฑเธชเธฃเธฒเธขเธเธฒเธฃเธชเธดเธเธเนเธฒเนเธกเนเธเนเธฒเธข");
                }
                const createdDetail = yield this.salesOrderDetailModel.create(salesOrderDetail);
                yield this.recalcByItemId(createdDetail.orders_item_id);
                const completeDetail = yield this.salesOrderDetailModel.findOne(createdDetail.id);
                if (completeDetail) {
                    this.socketService.emit('salesOrderDetail:create', completeDetail);
                    return completeDetail;
                }
                return createdDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, salesOrderDetail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const detailToUpdate = yield this.salesOrderDetailModel.findOne(id);
                if (!detailToUpdate) {
                    throw new Error("ไม่พบรายละเอียดเพิ่มเติมที่ต้องการแก้ไข");
                }
                const updatedDetail = yield this.salesOrderDetailModel.update(id, salesOrderDetail);
                yield this.recalcByItemId(detailToUpdate.orders_item_id);
                this.socketService.emit('salesOrderDetail:update', updatedDetail);
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
                const detailToDelete = yield this.salesOrderDetailModel.findOne(id);
                yield this.salesOrderDetailModel.delete(id);
                yield this.recalcByItemId(detailToDelete === null || detailToDelete === void 0 ? void 0 : detailToDelete.orders_item_id);
                this.socketService.emit('salesOrderDetail:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderDetailService = SalesOrderDetailService;
