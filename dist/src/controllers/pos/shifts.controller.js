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
const auditLogger_1 = require("../../utils/auditLogger");
const ApiResponse_1 = require("../../utils/ApiResponse");
const securityLogger_1 = require("../../utils/securityLogger");
const branch_middleware_1 = require("../../middleware/branch.middleware");
class ShiftsController {
    constructor(shiftsService) {
        this.shiftsService = shiftsService;
        this.openShift = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get user_id from authenticated user
            const user_id = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            const branch_id = (0, branch_middleware_1.getBranchId)(req);
            const { start_amount } = req.body;
            if (!user_id) {
                throw new AppError_1.AppError("Unauthorized - User not authenticated", 401);
            }
            if (start_amount === undefined || start_amount === null) {
                throw new AppError_1.AppError("กรุณาระบุจำนวนเงินทอนเริ่มต้น", 400);
            }
            const shift = yield this.shiftsService.openShift(user_id, Number(start_amount), branch_id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.SHIFT_OPEN }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get('User-Agent'), entity_type: 'Shifts', entity_id: shift.id, branch_id, new_values: { start_amount: Number(start_amount) }, path: req.originalUrl, method: req.method, description: `Open shift ${shift.id}` }));
            return ApiResponse_1.ApiResponses.created(res, shift);
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
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.SHIFT_CLOSE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get('User-Agent'), entity_type: 'Shifts', entity_id: shift.id, branch_id: (0, branch_middleware_1.getBranchId)(req), new_values: { end_amount: Number(end_amount) }, path: req.originalUrl, method: req.method, description: `Close shift ${shift.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, shift);
        }));
        this.getCurrentShift = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Get user_id from authenticated user
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                throw new AppError_1.AppError("Unauthorized - User not authenticated", 401);
            }
            const shift = yield this.shiftsService.getCurrentShift(userId);
            return ApiResponse_1.ApiResponses.ok(res, shift);
        }));
        this.getSummary = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const summary = yield this.shiftsService.getShiftSummary(id, branchId);
            return ApiResponse_1.ApiResponses.ok(res, summary);
        }));
        this.getCurrentSummary = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId)
                throw new AppError_1.AppError("Unauthorized", 401);
            const currentShift = yield this.shiftsService.getCurrentShift(userId);
            if (!currentShift)
                throw new AppError_1.AppError("No active shift found", 404);
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const summary = yield this.shiftsService.getShiftSummary(currentShift.id, branchId);
            return ApiResponse_1.ApiResponses.ok(res, summary);
        }));
    }
}
exports.ShiftsController = ShiftsController;
