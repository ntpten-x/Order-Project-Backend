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
exports.OrdersService = void 0;
const socket_service_1 = require("./socket.service");
class OrdersService {
    constructor(ordersModel) {
        this.ordersModel = ordersModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    createOrder(orderedById, items, remark) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const completeOrder = yield this.ordersModel.createOrderWithItems(orderedById, items, remark);
                this.socketService.emit("orders_updated", { action: "create", data: completeOrder });
                return completeOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    getAllOrders() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.ordersModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    getOrderById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.ordersModel.findById(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateOrder(id, items) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedOrder = yield this.ordersModel.updateOrderItems(id, items);
                this.socketService.emit("orders_updated", { action: "update_order", data: updatedOrder });
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    updateStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedOrder = yield this.ordersModel.updateStatus(id, status);
                if (!updatedOrder)
                    throw new Error("ไม่พบข้อมูลการสั่งซื้อ");
                this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    deleteOrder(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deleted = yield this.ordersModel.delete(id);
                if (deleted) {
                    this.socketService.emit("orders_updated", { action: "delete", id });
                }
                return { affected: deleted ? 1 : 0 };
            }
            catch (error) {
                throw error;
            }
        });
    }
    confirmPurchase(id, items, purchasedById) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedOrder = yield this.ordersModel.confirmPurchase(id, items, purchasedById);
                this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersService = OrdersService;
