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
exports.ShiftsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
class ShiftsController {
    constructor(shiftsService) {
        this.shiftsService = shiftsService;
        this.openShift = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get user_id from authenticated user
            const user_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const { start_amount } = req.body;
            if (!user_id) {
                throw new AppError_1.AppError("Unauthorized - User not authenticated", 401);
            }
            if (start_amount === undefined || start_amount === null) {
                throw new AppError_1.AppError("กรุณาระบุจำนวนเงินทอนเริ่มต้น", 400);
            }
            const shift = yield this.shiftsService.openShift(user_id, Number(start_amount));
            res.status(201).json(shift);
        }));
        this.closeShift = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get user_id from authenticated user
            const user_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const { end_amount } = req.body;
            if (!user_id) {
                throw new AppError_1.AppError("Unauthorized - User not authenticated", 401);
            }
            if (end_amount === undefined || end_amount === null) {
                throw new AppError_1.AppError("กรุณาระบุจำนวนเงินที่นับได้", 400);
            }
            const shift = yield this.shiftsService.closeShift(user_id, Number(end_amount));
            res.status(200).json(shift);
        }));
        this.getCurrentShift = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get user_id from authenticated user
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new AppError_1.AppError("Unauthorized - User not authenticated", 401);
            }
            const shift = yield this.shiftsService.getCurrentShift(userId);
            res.status(200).json(shift);
        }));
    }
}
exports.ShiftsController = ShiftsController;
