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
exports.SalesOrderItemController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const branch_middleware_1 = require("../../middleware/branch.middleware");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
/**
 * Sales Order Item Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
class SalesOrderItemController {
    constructor(salesOrderItemService) {
        this.salesOrderItemService = salesOrderItemService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const items = yield this.salesOrderItemService.findAll(branchId);
            return ApiResponse_1.ApiResponses.ok(res, items);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const item = yield this.salesOrderItemService.findOne(req.params.id, branchId);
            if (!item) {
                throw AppError_1.AppError.notFound("รายการสินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, item);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const item = yield this.salesOrderItemService.create(req.body, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ITEM_ADD }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "SalesOrderItem", entity_id: item.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create sales order item ${item.id}` }));
            return ApiResponse_1.ApiResponses.created(res, item);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldItem = yield this.salesOrderItemService.findOne(req.params.id, branchId);
            const item = yield this.salesOrderItemService.update(req.params.id, req.body, branchId);
            if (item) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ITEM_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "SalesOrderItem", entity_id: req.params.id, branch_id: branchId, old_values: oldItem, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update sales order item ${req.params.id}` }));
            }
            if (!item) {
                throw AppError_1.AppError.notFound("รายการสินค้า");
            }
            return ApiResponse_1.ApiResponses.ok(res, item);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldItem = yield this.salesOrderItemService.findOne(req.params.id, branchId);
            yield this.salesOrderItemService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ITEM_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "SalesOrderItem", entity_id: req.params.id, branch_id: branchId, old_values: oldItem, path: req.originalUrl, method: req.method, description: `Delete sales order item ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบรายการสินค้าในออเดอร์สำเร็จ" });
        }));
    }
}
exports.SalesOrderItemController = SalesOrderItemController;
