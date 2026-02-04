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
exports.RolesController = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
const auditLogger_1 = require("../utils/auditLogger");
const securityLogger_1 = require("../utils/securityLogger");
class RolesController {
    constructor(rolesService) {
        this.rolesService = rolesService;
        this.findAll = (0, catchAsync_1.catchAsync)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            const roles = yield this.rolesService.findAll();
            return ApiResponse_1.ApiResponses.ok(res, roles);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const role = yield this.rolesService.findOne(req.params.id);
            if (!role) {
                throw AppError_1.AppError.notFound("Role");
            }
            return ApiResponse_1.ApiResponses.ok(res, role);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const role = yield this.rolesService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ROLE_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Roles", entity_id: role.id, branch_id: userInfo.branch_id, new_values: req.body, path: req.originalUrl, method: req.method, description: `Create role ${role.roles_name || role.id}` }));
            return ApiResponse_1.ApiResponses.created(res, role);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const oldRole = yield this.rolesService.findOne(req.params.id);
            const role = yield this.rolesService.update(req.params.id, req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ROLE_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Roles", entity_id: req.params.id, branch_id: userInfo.branch_id, old_values: oldRole, new_values: req.body, path: req.originalUrl, method: req.method, description: `Update role ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, role);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const oldRole = yield this.rolesService.findOne(req.params.id);
            yield this.rolesService.delete(req.params.id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.ROLE_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Roles", entity_id: req.params.id, branch_id: userInfo.branch_id, old_values: oldRole, path: req.originalUrl, method: req.method, description: `Delete role ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
}
exports.RolesController = RolesController;
