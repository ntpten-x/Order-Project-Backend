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
exports.PaymentsService = void 0;
const socket_service_1 = require("../socket.service");
const shifts_service_1 = require("./shifts.service");
const AppError_1 = require("../../utils/AppError");
class PaymentsService {
    constructor(paymentsModel) {
        this.paymentsModel = paymentsModel;
        this.socketService = socket_service_1.SocketService.getInstance();
        this.shiftsService = new shifts_service_1.ShiftsService();
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentsModel.findAll();
            }
            catch (error) {
                throw error;
            }
        });
    }
    findOne(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return this.paymentsModel.findOne(id);
            }
            catch (error) {
                throw error;
            }
        });
    }
    create(payments, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!payments.order_id) {
                    throw new Error("กรุณาระบุรหัสออเดอร์");
                }
                if (!payments.payment_method_id) {
                    throw new Error("กรุณาระบุรหัสวิธีการชำระเงิน");
                }
                if (payments.amount <= 0) {
                    throw new Error("ยอดเงินที่ชำระต้องมากกว่า 0");
                }
                // [NEW] Link to Active Shift
                const activeShift = yield this.shiftsService.getCurrentShift(userId);
                if (!activeShift) {
                    throw new AppError_1.AppError("กรุณาเปิดกะก่อนทำรายการชำระเงิน (Open Shift Required)", 400);
                }
                payments.shift_id = activeShift.id;
                const createdPayment = yield this.paymentsModel.create(payments);
                // Fetch complete data with relations to return
                const completePayment = yield this.paymentsModel.findOne(createdPayment.id);
                if (completePayment) {
                    this.socketService.emit('payments:create', completePayment);
                    return completePayment;
                }
                return createdPayment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    update(id, payments) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const paymentToUpdate = yield this.paymentsModel.findOne(id);
                if (!paymentToUpdate) {
                    throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการแก้ไข");
                }
                const updatedPayment = yield this.paymentsModel.update(id, payments);
                this.socketService.emit('payments:update', updatedPayment);
                return updatedPayment;
            }
            catch (error) {
                throw error;
            }
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.paymentsModel.delete(id);
                this.socketService.emit('payments:delete', { id });
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.PaymentsService = PaymentsService;
