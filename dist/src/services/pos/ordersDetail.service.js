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
exports.OrdersDetailService = void 0;
const socket_service_1 = require("../socket.service");
class OrdersDetailService {
    constructor(ordersDetailModel) {
        this.ordersDetailModel = ordersDetailModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersDetailModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersDetailModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(ordersDetail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!ordersDetail.orders_item_id) {
                    throw new Error("กรุณาระบุรหัสรายการสินค้าแม่ข่าย");
                }
                const createdDetail = yield this.ordersDetailModel.create(ordersDetail);
                const completeDetail = yield this.ordersDetailModel.findOne(createdDetail.id);
                if (completeDetail) {
                    this.socketService.emit('ordersDetail:create', completeDetail);
                    return completeDetail;
                }
                return createdDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, ordersDetail) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const detailToUpdate = yield this.ordersDetailModel.findOne(id);
                if (!detailToUpdate) {
                    throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมที่ต้องการแก้ไข");
                }
                const updatedDetail = yield this.ordersDetailModel.update(id, ordersDetail);
                this.socketService.emit('ordersDetail:update', updatedDetail);
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
                yield this.ordersDetailModel.delete(id);
                this.socketService.emit('ordersDetail:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersDetailService = OrdersDetailService;
