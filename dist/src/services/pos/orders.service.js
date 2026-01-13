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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const socket_service_1 = require("../socket.service");
class OrdersService {
    constructor(ordersModel) {
        this.ordersModel = ordersModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(page, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findAll(page, limit);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.ordersModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(orders) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!orders.order_no) {
                    throw new Error("กรุณาระบุเลขที่ออเดอร์");
                }
                const existingOrder = yield this.ordersModel.findOneByOrderNo(orders.order_no);
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                }
                // Check if there are items to create transactionally
                // The controller might pass items in a separate property or we attach them to the 'orders' object?
                // Usually 'orders' entity object doesn't have 'items' populated on create unless we type cast.
                // For now, let's assume if 'items' exists in the input object (even if not in Entity type during strict checking, but here it's JS runtime).
                // Better approach: Method specific for full creation.
                // Standard create (Header only)
                const createdOrder = yield this.ordersModel.create(orders);
                this.socketService.emit('orders:create', createdOrder);
                return createdOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    createFullOrder(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!data.order_no) {
                    throw new Error("กรุณาระบุเลขที่ออเดอร์");
                }
                const existingOrder = yield this.ordersModel.findOneByOrderNo(data.order_no);
                if (existingOrder) {
                    throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                }
                // Separate items from order data
                const { items } = data, orderData = __rest(data, ["items"]);
                const createdOrder = yield this.ordersModel.createFullOrder(orderData, items);
                // Fetch full data to emit
                const fullOrder = yield this.ordersModel.findOne(createdOrder.id);
                if (fullOrder) {
                    this.socketService.emit('orders:create', fullOrder);
                    return fullOrder;
                }
                return createdOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, orders) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orderToUpdate = yield this.ordersModel.findOne(id);
                if (!orderToUpdate) {
                    throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการแก้ไข");
                }
                if (orders.order_no && orders.order_no !== orderToUpdate.order_no) {
                    const existingOrder = yield this.ordersModel.findOneByOrderNo(orders.order_no);
                    if (existingOrder) {
                        throw new Error("เลขที่ออเดอร์นี้มีอยู่ในระบบแล้ว");
                    }
                }
                const updatedOrder = yield this.ordersModel.update(id, orders);
                this.socketService.emit('orders:update', updatedOrder);
                return updatedOrder;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.ordersModel.delete(id);
                this.socketService.emit('orders:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.OrdersService = OrdersService;
