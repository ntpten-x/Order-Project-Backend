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
exports.ShiftsService = void 0;
const database_1 = require("../../database/database");
const Shifts_1 = require("../../entity/pos/Shifts");
const Payments_1 = require("../../entity/pos/Payments");
const AppError_1 = require("../../utils/AppError");
class ShiftsService {
    constructor() {
        this.shiftsRepo = database_1.AppDataSource.getRepository(Shifts_1.Shifts);
        this.paymentsRepo = database_1.AppDataSource.getRepository(Payments_1.Payments);
    }
    openShift(userId, startAmount) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if user already has an OPEN shift
            const activeShift = yield this.shiftsRepo.findOne({
                where: {
                    user_id: userId,
                    status: Shifts_1.ShiftStatus.OPEN
                }
            });
            if (activeShift) {
                throw new AppError_1.AppError("ผู้ใช้งานนี้มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อนเปิดใหม่", 400);
            }
            const newShift = new Shifts_1.Shifts();
            newShift.user_id = userId;
            newShift.start_amount = startAmount;
            newShift.status = Shifts_1.ShiftStatus.OPEN;
            newShift.open_time = new Date();
            return yield this.shiftsRepo.save(newShift);
        });
    }
    getCurrentShift(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.shiftsRepo.findOne({
                where: {
                    user_id: userId,
                    status: Shifts_1.ShiftStatus.OPEN
                }
            });
        });
    }
    closeShift(userId, endAmount) {
        return __awaiter(this, void 0, void 0, function* () {
            const activeShift = yield this.getCurrentShift(userId);
            if (!activeShift) {
                throw new AppError_1.AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
            }
            // Calculate Total Sales during this shift
            // Sum of all payments linked to this shift
            const payments = yield this.paymentsRepo.find({
                where: { shift_id: activeShift.id }
            });
            const totalSales = payments.reduce((sum, p) => sum + Number(p.amount), 0);
            // Expected Amount = Start + Sales
            // Note: In real world, we might subtract payouts/expenses. For now simple logic.
            const expectedAmount = Number(activeShift.start_amount) + totalSales;
            activeShift.end_amount = endAmount;
            activeShift.expected_amount = expectedAmount;
            activeShift.diff_amount = Number(endAmount) - expectedAmount;
            activeShift.status = Shifts_1.ShiftStatus.CLOSED;
            activeShift.close_time = new Date();
            return yield this.shiftsRepo.save(activeShift);
        });
    }
}
exports.ShiftsService = ShiftsService;
