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
class SalesOrderItemService {
    constructor(salesOrderItemModel) {
        this.salesOrderItemModel = salesOrderItemModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderItemModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.salesOrderItemModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(salesOrderItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!salesOrderItem.order_id) {
                    throw new Error("กรุณาระบุรหัสออเดอร์");
                }
                if (!salesOrderItem.product_id) {
                    throw new Error("กรุณาระบุรหัสสินค้า");
                }
                const createdItem = yield this.salesOrderItemModel.create(salesOrderItem);
                const completeItem = yield this.salesOrderItemModel.findOne(createdItem.id);
                if (completeItem) {
                    this.socketService.emit('salesOrderItem:create', completeItem);
                    return completeItem;
                }
                return createdItem;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, salesOrderItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const itemToUpdate = yield this.salesOrderItemModel.findOne(id);
                if (!itemToUpdate) {
                    throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข");
                }
                const updatedItem = yield this.salesOrderItemModel.update(id, salesOrderItem);
                this.socketService.emit('salesOrderItem:update', updatedItem);
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
                yield this.salesOrderItemModel.delete(id);
                this.socketService.emit('salesOrderItem:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.SalesOrderItemService = SalesOrderItemService;
