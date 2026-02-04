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
exports.DiscountsController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
class DiscountsController {
    constructor(discountsService) {
        this.discountsService = discountsService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const q = req.query.q || undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const discounts = yield this.discountsService.findAll(q, branchId);
            return ApiResponse_1.ApiResponses.ok(res, discounts);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const discount = yield this.discountsService.findOne(req.params.id, branchId);
            if (!discount) {
                throw AppError_1.AppError.notFound("ส่วนลด");
            }
            return ApiResponse_1.ApiResponses.ok(res, discount);
        }));
        this.findByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const discount = yield this.discountsService.findOneByName(req.params.name, branchId);
            if (!discount) {
                throw AppError_1.AppError.notFound("ส่วนลด");
            }
            return ApiResponse_1.ApiResponses.ok(res, discount);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const discount = yield this.discountsService.create(req.body, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.DISCOUNT_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get('User-Agent'), entity_type: 'Discounts', entity_id: discount.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create discount ${discount.discount_name || discount.display_name || discount.id}` }));
            return ApiResponse_1.ApiResponses.created(res, discount);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldDiscount = yield this.discountsService.findOne(req.params.id, branchId);
            const discount = yield this.discountsService.update(req.params.id, req.body, branchId);
            if (discount) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.DISCOUNT_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Discounts", entity_id: req.params.id, branch_id: branchId, old_values: oldDiscount, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update discount ${req.params.id}` }));
            }
            if (!discount) {
                throw AppError_1.AppError.notFound("ส่วนลด");
            }
            return ApiResponse_1.ApiResponses.ok(res, discount);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldDiscount = yield this.discountsService.findOne(req.params.id, branchId);
            yield this.discountsService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.DISCOUNT_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get('User-Agent'), entity_type: 'Discounts', entity_id: req.params.id, branch_id: branchId, old_values: oldDiscount, path: req.originalUrl, method: req.method, description: `Delete discount ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบข้อมูลส่วนลดสำเร็จ" });
        }));
    }
}
exports.DiscountsController = DiscountsController;
