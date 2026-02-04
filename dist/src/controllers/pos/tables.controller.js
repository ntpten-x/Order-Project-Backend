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
exports.TablesController = void 0;
const catchAsync_1 = require("../../utils/catchAsync");
const AppError_1 = require("../../utils/AppError");
const ApiResponse_1 = require("../../utils/ApiResponse");
const auditLogger_1 = require("../../utils/auditLogger");
const securityLogger_1 = require("../../utils/securityLogger");
const branch_middleware_1 = require("../../middleware/branch.middleware");
/**
 * Tables Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Pagination support
 */
class TablesController {
    constructor(tablesService) {
        this.tablesService = tablesService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const rawLimit = parseInt(req.query.limit);
            const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
            const q = req.query.q || undefined;
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const result = yield this.tablesService.findAll(page, limit, q, branchId);
            // Check if result has pagination structure
            if (result.data && result.total !== undefined) {
                return ApiResponse_1.ApiResponses.paginated(res, result.data, {
                    page: result.page || page,
                    limit: limit,
                    total: result.total,
                });
            }
            return ApiResponse_1.ApiResponses.ok(res, result);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const table = yield this.tablesService.findOne(req.params.id, branchId);
            if (!table) {
                throw AppError_1.AppError.notFound("โต๊ะ");
            }
            return ApiResponse_1.ApiResponses.ok(res, table);
        }));
        this.findByName = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const table = yield this.tablesService.findOneByName(req.params.name, branchId);
            if (!table) {
                throw AppError_1.AppError.notFound("โต๊ะ");
            }
            return ApiResponse_1.ApiResponses.ok(res, table);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const table = yield this.tablesService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.TABLE_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Tables", entity_id: table.id, branch_id: branchId, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create table ${table.table_name || table.id}` }));
            return ApiResponse_1.ApiResponses.created(res, table);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            if (branchId) {
                req.body.branch_id = branchId;
            }
            const oldTable = yield this.tablesService.findOne(req.params.id, branchId);
            const table = yield this.tablesService.update(req.params.id, req.body, branchId);
            if (table) {
                const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
                yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.TABLE_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Tables", entity_id: req.params.id, branch_id: branchId, old_values: oldTable, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update table ${req.params.id}` }));
            }
            if (!table) {
                throw AppError_1.AppError.notFound("โต๊ะ");
            }
            return ApiResponse_1.ApiResponses.ok(res, table);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branchId = (0, branch_middleware_1.getBranchId)(req);
            const oldTable = yield this.tablesService.findOne(req.params.id, branchId);
            yield this.tablesService.delete(req.params.id, branchId);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.TABLE_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Tables", entity_id: req.params.id, branch_id: branchId, old_values: oldTable, path: req.originalUrl, method: req.method, description: `Delete table ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "ลบข้อมูลโต๊ะสำเร็จ" });
        }));
    }
}
exports.TablesController = TablesController;
