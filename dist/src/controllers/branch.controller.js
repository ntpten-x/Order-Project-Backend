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
exports.BranchController = void 0;
const branch_service_1 = require("../services/branch.service");
const catchAsync_1 = require("../utils/catchAsync");
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
const auditLogger_1 = require("../utils/auditLogger");
const securityLogger_1 = require("../utils/securityLogger");
class BranchController {
    constructor() {
        this.branchService = new branch_service_1.BranchService();
        this.getAll = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            const branches = yield this.branchService.findAll();
            return ApiResponse_1.ApiResponses.ok(res, branches);
        }));
        this.getOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const branch = yield this.branchService.findOne(id);
            if (!branch) {
                throw AppError_1.AppError.notFound("Branch");
            }
            return ApiResponse_1.ApiResponses.ok(res, branch);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const branch = yield this.branchService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.BRANCH_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Branch", entity_id: branch.id, branch_id: userInfo.branch_id, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create branch ${branch.branch_name || branch.id}` }));
            return ApiResponse_1.ApiResponses.created(res, branch);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const oldBranch = yield this.branchService.findOne(id);
            const branch = yield this.branchService.update(id, req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.BRANCH_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Branch", entity_id: id, branch_id: userInfo.branch_id, old_values: oldBranch, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update branch ${id}` }));
            return ApiResponse_1.ApiResponses.ok(res, branch);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const oldBranch = yield this.branchService.findOne(id);
            yield this.branchService.delete(id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.BRANCH_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Branch", entity_id: id, branch_id: userInfo.branch_id, old_values: oldBranch, new_values: { is_active: false }, path: req.originalUrl, method: req.method, description: `Delete branch ${id}` }));
            return ApiResponse_1.ApiResponses.ok(res, { message: "Branch deleted successfully" });
        }));
    }
}
exports.BranchController = BranchController;
