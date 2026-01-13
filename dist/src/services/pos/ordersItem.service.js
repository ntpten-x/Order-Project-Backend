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
exports.OrdersItemService = void 0;
const socket_service_1 = require("../socket.service");
class OrdersItemService {
    constructor(ordersItemModel) {
        this.ordersItemModel = ordersItemModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersItemModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersItemModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ordersItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!ordersItem.order_id) {
                    throw new Error("กรุณาระบุรหัสออเดอร์");
                }
                if (!ordersItem.product_id) {
                    throw new Error("กรุณาระบุรหัสสินค้า");
                }
                const createdItem = yield this.ordersItemModel.create(ordersItem);
                const completeItem = yield this.ordersItemModel.findOne(createdItem.id);
                if (completeItem) {
                    this.socketService.emit('ordersItem:create', completeItem);
                    return completeItem;
                }
                return createdItem;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ordersItem) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const itemToUpdate = yield this.ordersItemModel.findOne(id);
                if (!itemToUpdate) {
                    throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข");
                }
                const updatedItem = yield this.ordersItemModel.update(id, ordersItem);
                this.socketService.emit('ordersItem:update', updatedItem);
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
                yield this.ordersItemModel.delete(id);
                this.socketService.emit('ordersItem:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersItemService = OrdersItemService;
