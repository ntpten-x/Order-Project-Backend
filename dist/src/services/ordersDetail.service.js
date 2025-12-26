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
const socket_service_1 = require("./socket.service");
class OrdersDetailService {
    constructor(ordersDetailModel) {
        this.ordersDetailModel = ordersDetailModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    updatePurchaseDetail(ordersItemId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const savedDetail = yield this.ordersDetailModel.createOrUpdate(ordersItemId, data);
                // Fetch related info for socket
                const orderItem = yield this.ordersDetailModel.getOrderItemWithOrder(ordersItemId);
                if (orderItem) {
                    this.socketService.emit("orders_updated", {
                        action: "update_item_detail",
                        orderId: orderItem.orders.id,
                        data: savedDetail
                    });
                }
                return savedDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    getDetailByItemId(ordersItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.ordersDetailModel.findByOrderItemId(ordersItemId);
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersDetailService = OrdersDetailService;
