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
exports.PaymentMethodService = void 0;
const socket_service_1 = require("../socket.service");
class PaymentMethodService {
    constructor(paymentMethodModel) {
        this.paymentMethodModel = paymentMethodModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentMethodModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentMethodModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(paymentMethod) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!paymentMethod.payment_method_name) {
                    throw new Error("กรุณาระบุชื่อวิธีการชำระเงิน");
                }
                const existingPaymentMethod = yield this.paymentMethodModel.findOneByName(paymentMethod.payment_method_name);
                if (existingPaymentMethod) {
                    throw new Error("ชื่อวิธีการชำระเงินนี้มีอยู่ในระบบแล้ว");
                }
                const createdPaymentMethod = yield this.paymentMethodModel.create(paymentMethod);
                this.socketService.emit('paymentMethod:create', createdPaymentMethod);
                return createdPaymentMethod;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, paymentMethod) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentMethodToUpdate = yield this.paymentMethodModel.findOne(id);
                if (!paymentMethodToUpdate) {
                    throw new Error("ไม่พบข้อมูลวิธีการชำระเงินที่ต้องการแก้ไข");
                }
                if (paymentMethod.payment_method_name && paymentMethod.payment_method_name !== paymentMethodToUpdate.payment_method_name) {
                    const existingPaymentMethod = yield this.paymentMethodModel.findOneByName(paymentMethod.payment_method_name);
                    if (existingPaymentMethod) {
                        throw new Error("ชื่อวิธีการชำระเงินนี้มีอยู่ในระบบแล้ว");
                    }
                }
                const updatedPaymentMethod = yield this.paymentMethodModel.update(id, paymentMethod);
                this.socketService.emit('paymentMethod:update', updatedPaymentMethod);
                return updatedPaymentMethod;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentMethodModel.delete(id);
                this.socketService.emit('paymentMethod:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentMethodService = PaymentMethodService;
