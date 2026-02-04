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
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
class PaymentsController {
    constructor(paymentsService) {
        this.paymentsService = paymentsService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const payments = yield this.paymentsService.findAll(branchId);
            return ApiResponse_1.ApiResponses.ok(res, payments);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const payment = yield this.paymentsService.findOne(req.params.id, branchId);
            if (!payment)
                throw new AppError_1.AppError("ไม่พบข้อมูลการชำระเงิน", 404);
            return ApiResponse_1.ApiResponses.ok(res, payment);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            // Assume Auth Middleware has populated req.user
            const user = req.user;
            if (!user || !user.id) {
                throw new AppError_1.AppError("Authentication required (User ID missing)", 401);
            }
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                // Always enforce branch isolation server-side
                req.body.branch_id = branchId;
            }
            const payment = yield this.paymentsService.create(req.body, user.id, branchId);
            // Audit log - CRITICAL for payment tracking
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.PAYMENT_CREATE,
                user_id: user.id,
                username: user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'Payments',
                entity_id: payment.id,
                branch_id: branchId,
                new_values: {
                    order_id: payment.order_id,
                    amount: payment.amount,
                    payment_method_id: payment.payment_method_id,
                    status: payment.status
                },
                description: `Created payment for order ${payment.order_id} - Amount: ${payment.amount}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.created(res, payment);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                // Prevent branch_id tampering
                req.body.branch_id = branchId;
            }
            const oldPayment = yield this.paymentsService.findOne(req.params.id, branchId);
            const payment = yield this.paymentsService.update(req.params.id, req.body, branchId);
            // Audit log - payment changes are critical
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.PAYMENT_UPDATE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'Payments',
                entity_id: payment.id,
                branch_id: branchId,
                old_values: oldPayment ? { amount: oldPayment.amount, status: oldPayment.status, payment_method_id: oldPayment.payment_method_id } : undefined,
                new_values: { amount: payment.amount, status: payment.status, payment_method_id: payment.payment_method_id },
                description: `Updated payment ${payment.id} for order ${payment.order_id}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.ok(res, payment);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = req.user;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldPayment = yield this.paymentsService.findOne(req.params.id, branchId);
            yield this.paymentsService.delete(req.params.id, branchId);
            yield auditLogger_1.auditLogger.log({
                action_type: auditLogger_1.AuditActionType.PAYMENT_DELETE,
                user_id: user === null || user === void 0 ? void 0 : user.id,
                username: user === null || user === void 0 ? void 0 : user.username,
                ip_address: (0, securityLogger_1.getClientIp)(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'Payments',
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldPayment ? { order_id: oldPayment.order_id, amount: oldPayment.amount, status: oldPayment.status } : undefined,
                description: oldPayment ? `Deleted payment ${req.params.id} for order ${oldPayment.order_id}` : `Deleted payment ${req.params.id}`,
                path: req.path,
                method: req.method,
            });
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
}
exports.PaymentsController = PaymentsController;
