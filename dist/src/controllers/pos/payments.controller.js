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
exports.PaymentsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const payments = yield this.paymentsService.findAll();
            res.status(200).json(payments);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const payment = yield this.paymentsService.findOne(req.params.id);
            if (!payment)
                throw new AppError_1.AppError("ไม่พบข้อมูลการชำระเงิน", 404);
            res.status(200).json(payment);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            // Assume Auth Middleware has populated req.user
            const user = req.user;
            if (!user || !user.id) {
                throw new AppError_1.AppError("Authentication required (User ID missing)", 401);
            }
            const payment = yield this.paymentsService.create(req.body, user.id);
            res.status(201).json(payment);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const payment = yield this.paymentsService.update(req.params.id, req.body);
            res.status(200).json(payment);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield this.paymentsService.delete(req.params.id);
            res.status(200).json({ message: "ลบข้อมูลการชำระเงินสำเร็จ" });
        }));
    }
}
exports.PaymentsController = PaymentsController;
