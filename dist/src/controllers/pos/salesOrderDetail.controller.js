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
exports.SalesOrderDetailController = void 0;
const branch_middleware_1 = require("../../middleware/branch.middleware");
const catchAsync_1 = require("../../utils/catchAsync");
const ApiResponse_1 = require("../../utils/ApiResponse");
const AppError_1 = require("../../utils/AppError");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
class SalesOrderDetailController {
    constructor(salesOrderDetailService) {
        this.salesOrderDetailService = salesOrderDetailService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const details = yield this.salesOrderDetailService.findAll(branchId);
            return ApiResponse_1.ApiResponses.ok(res, details);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const detail = yield this.salesOrderDetailService.findOne(req.params.id, branchId);
            if (!detail)
                throw AppError_1.AppError.notFound("Sales order detail");
            return ApiResponse_1.ApiResponses.ok(res, detail);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const detail = yield this.salesOrderDetailService.create(req.body, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ITEM_ADD }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "SalesOrderDetail", entity_id: detail.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create sales order detail ${detail.id}` }));
            return ApiResponse_1.ApiResponses.created(res, detail);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldDetail = yield this.salesOrderDetailService.findOne(req.params.id, branchId);
            const detail = yield this.salesOrderDetailService.update(req.params.id, req.body, branchId);
            if (detail) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ITEM_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "SalesOrderDetail", entity_id: req.params.id, branch_id: branchId, old_values: oldDetail, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update sales order detail ${req.params.id}` }));
            }
            return ApiResponse_1.ApiResponses.ok(res, detail);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            /* try {
                const branchId = getBranchId(req as any);
                await this.salesOrderDetailService.delete(req.params.id, branchId)
                res.status(200).json({ message: "ลบรายละเอียดเพิ่มเติมสำเร็จ" })
            } catch (error: any) {
                res.status(500).json({ error: error.message })
            } */
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldDetail = yield this.salesOrderDetailService.findOne(req.params.id, branchId);
            yield this.salesOrderDetailService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ITEM_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "SalesOrderDetail", entity_id: req.params.id, branch_id: branchId, old_values: oldDetail, path: req.originalUrl, method: req.method, description: `Delete sales order detail ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
}
exports.SalesOrderDetailController = SalesOrderDetailController;
