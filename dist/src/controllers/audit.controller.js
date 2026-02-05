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
exports.AuditController = void 0;
const audit_service_1 = require("../services/audit.service");
const catchAsync_1 = require("../utils/catchAsync");
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
class AuditController {
    constructor() {
        this.auditService = new audit_service_1.AuditService();
        this.getLogs = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const isAdmin = ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.roles_name) === "Admin";
            const query = req.query;
            const page = query.page ? Number(query.page) : 1;
            const limit = query.limit ? Number(query.limit) : 20;
            const requestedBranch = query.branch_id;
            const effectiveBranchId = isAdmin ? requestedBranch : (_c = req.user) === null || _c === void 0 ? void 0 : _c.branch_id;
            // Non-admins cannot access other branches
            if (!isAdmin && requestedBranch && requestedBranch !== ((_d = req.user) === null || _d === void 0 ? void 0 : _d.branch_id)) {
                return ApiResponse_1.ApiResponses.forbidden(res, "Access denied");
            }
            const filters = {
                page,
                limit,
                action_type: query.action_type,
                entity_type: query.entity_type,
                entity_id: query.entity_id,
                user_id: query.user_id,
                branch_id: effectiveBranchId,
                start_date: query.start_date ? new Date(String(query.start_date)) : undefined,
                end_date: query.end_date ? new Date(String(query.end_date)) : undefined,
                search: query.search,
            };
            const { logs, total } = yield this.auditService.getLogs(filters);
            return ApiResponse_1.ApiResponses.paginated(res, logs, {
                page: filters.page || 1,
                limit: filters.limit || 20,
                total,
            });
        }));
        this.getById = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const isAdmin = ((_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.roles_name) === "Admin";
            const log = yield this.auditService.getById(req.params.id);
            if (!log) {
                throw AppError_1.AppError.notFound("Audit log");
            }
            if (!isAdmin && log.branch_id && log.branch_id !== ((_c = req.user) === null || _c === void 0 ? void 0 : _c.branch_id)) {
                return ApiResponse_1.ApiResponses.forbidden(res, "Access denied");
            }
            return ApiResponse_1.ApiResponses.ok(res, log);
        }));
    }
}
exports.AuditController = AuditController;
