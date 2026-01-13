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
exports.PaymentDetailsService = void 0;
const socket_service_1 = require("../socket.service");
class PaymentDetailsService {
    constructor(paymentDetailsModel) {
        this.paymentDetailsModel = paymentDetailsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentDetailsModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentDetailsModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(paymentDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!paymentDetails.payment_id) {
                    throw new Error("กรุณาระบุรหัสการชำระเงินหลัก");
                }
                const createdDetail = yield this.paymentDetailsModel.create(paymentDetails);
                this.socketService.emit('paymentDetails:create', createdDetail);
                return createdDetail;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, paymentDetails) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const detailToUpdate = yield this.paymentDetailsModel.findOne(id);
                if (!detailToUpdate) {
                    throw new Error("ไม่พบข้อมูลรายละเอียดการชำระเงินที่ต้องการแก้ไข");
                }
                const updatedDetail = yield this.paymentDetailsModel.update(id, paymentDetails);
                this.socketService.emit('paymentDetails:update', updatedDetail);
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
                yield this.paymentDetailsModel.delete(id);
                this.socketService.emit('paymentDetails:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentDetailsService = PaymentDetailsService;
