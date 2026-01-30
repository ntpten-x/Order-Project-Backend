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
exports.DeliveryService = void 0;
const socket_service_1 = require("../socket.service");
class DeliveryService {
    constructor(deliveryModel) {
        this.deliveryModel = deliveryModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll(page, limit, q) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.deliveryModel.findAll(page, limit, q);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.deliveryModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOneByName(delivery_name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.deliveryModel.findOneByName(delivery_name);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(delivery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!delivery.delivery_name) {
                    throw new Error("กรุณาระบุชื่อบริการส่ง");
                }
                const existingDelivery = yield this.deliveryModel.findOneByName(delivery.delivery_name);
                if (existingDelivery) {
                    throw new Error("ชื่อบริการส่งนี้มีอยู่ในระบบแล้ว");
                }
                const createdDelivery = yield this.deliveryModel.create(delivery);
                this.socketService.emit('delivery:create', createdDelivery);
                return createdDelivery;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, delivery) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deliveryToUpdate = yield this.deliveryModel.findOne(id);
                if (!deliveryToUpdate) {
                    throw new Error("ไม่พบข้อมูลบริการส่งที่ต้องการแก้ไข");
                }
                if (delivery.delivery_name && delivery.delivery_name !== deliveryToUpdate.delivery_name) {
                    const existingDelivery = yield this.deliveryModel.findOneByName(delivery.delivery_name);
                    if (existingDelivery) {
                        throw new Error("ชื่อบริการส่งนี้มีอยู่ในระบบแล้ว");
                    }
                }
                const updatedDelivery = yield this.deliveryModel.update(id, delivery);
                this.socketService.emit('delivery:update', updatedDelivery);
                return updatedDelivery;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.deliveryModel.delete(id);
                this.socketService.emit('delivery:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.DeliveryService = DeliveryService;
