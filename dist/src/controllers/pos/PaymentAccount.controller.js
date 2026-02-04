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
exports.PaymentAccountController = void 0;
const PaymentAccount_service_1 = require("../../services/pos/PaymentAccount.service");
const PaymentAccount_model_1 = require("../../models/pos/PaymentAccount.model");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const auditLogger_1 = require("../../utils/auditLogger");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const AppError_1 = require("../../utils/AppError");
const securityLogger_1 = require("../../utils/securityLogger");
class PaymentAccountController {
    constructor() {
        this.getAccounts = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (!branchId)
                throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
            const accounts = yield this.service.getAccounts(branchId);
            return ApiResponse_1.ApiResponses.ok(res, accounts);
        }));
        this.createAccount = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (!branchId)
                throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
            const account = yield this.service.createAccount(branchId, req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_ACCOUNT_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ShopPaymentAccount", entity_id: account.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create payment account ${account.id}` }));
            return ApiResponse_1.ApiResponses.created(res, account);
        }));
        this.updateAccount = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (!branchId)
                throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
            const { id } = req.params;
            const oldAccount = (yield this.service.getAccounts(branchId)).find((a) => a.id === id);
            const account = yield this.service.updateAccount(branchId, id, req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_ACCOUNT_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ShopPaymentAccount", entity_id: id, branch_id: branchId, old_values: oldAccount, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update payment account ${id}` }));
            return ApiResponse_1.ApiResponses.ok(res, account);
        }));
        this.activateAccount = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (!branchId)
                throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
            const { id } = req.params;
            const account = yield this.service.activateAccount(branchId, id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_ACCOUNT_ACTIVATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ShopPaymentAccount", entity_id: id, branch_id: branchId, new_values: { is_active: true }, path: req.originalUrl, method: req.method, description: `Activate payment account ${id}` }));
            return ApiResponse_1.ApiResponses.ok(res, account);
        }));
        this.deleteAccount = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (!branchId)
                throw AppError_1.AppError.forbidden("Access denied: No branch assigned to user");
            const { id } = req.params;
            const oldAccount = (yield this.service.getAccounts(branchId)).find((a) => a.id === id);
            yield this.service.deleteAccount(branchId, id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.PAYMENT_ACCOUNT_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "ShopPaymentAccount", entity_id: id, branch_id: branchId, old_values: oldAccount, path: req.originalUrl, method: req.method, description: `Delete payment account ${id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
        this.service = new PaymentAccount_service_1.PaymentAccountService(new PaymentAccount_model_1.PaymentAccountModel());
    }
}
exports.PaymentAccountController = PaymentAccountController;
