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
exports.PaymentMethodController = void 0;
const branch_middleware_1 = require("../../middleware/branch.middleware");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const AppError_1 = require("../../utils/AppError");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
class PaymentMethodController {
    constructor(paymentMethodService) {
        this.paymentMethodService = paymentMethodService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const rawLimit = parseInt(req.query.limit);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
            const q = req.query.q || undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.paymentMethodService.findAll(page, limit, q, branchId);
            return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                page: result.page,
                limit,
                total: result.total,
            });
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const paymentMethod = yield this.paymentMethodService.findOne(req.params.id, branchId);
            if (!paymentMethod)
                throw AppError_1.AppError.notFound("Payment method");
            return ApiResponse_1.ApiResponses.ok(res, paymentMethod);
        }));
        this.findByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const paymentMethod = yield this.paymentMethodService.findOneByName(req.params.name, branchId);
            if (!paymentMethod)
                throw AppError_1.AppError.notFound("Payment method");
            return ApiResponse_1.ApiResponses.ok(res, paymentMethod);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const paymentMethod = yield this.paymentMethodService.create(req.body, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_METHOD_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PaymentMethod", entity_id: paymentMethod.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create payment method ${paymentMethod.payment_method_name || paymentMethod.id}` }));
            return ApiResponse_1.ApiResponses.created(res, paymentMethod);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldPaymentMethod = yield this.paymentMethodService.findOne(req.params.id, branchId);
            const paymentMethod = yield this.paymentMethodService.update(req.params.id, req.body, branchId);
            if (paymentMethod) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_METHOD_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PaymentMethod", entity_id: req.params.id, branch_id: branchId, old_values: oldPaymentMethod, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update payment method ${req.params.id}` }));
            }
            return ApiResponse_1.ApiResponses.ok(res, paymentMethod);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            /* try {
                const branchId = getBranchId(req as any);
                await this.paymentMethodService.delete(req.params.id, branchId)
                res.status(200).json({ message: "ลบข้อมูลวิธีการชำระเงินสำเร็จ" })
            } catch (error: any) {
                res.status(500).json({ error: error.message })
            } */
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldPaymentMethod = yield this.paymentMethodService.findOne(req.params.id, branchId);
            yield this.paymentMethodService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_METHOD_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "PaymentMethod", entity_id: req.params.id, branch_id: branchId, old_values: oldPaymentMethod, path: req.originalUrl, method: req.method, description: `Delete payment method ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
}
exports.PaymentMethodController = PaymentMethodController;
