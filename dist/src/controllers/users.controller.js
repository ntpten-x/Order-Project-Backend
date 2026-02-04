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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
const auditLogger_1 = require("../utils/auditLogger");
const securityLogger_1 = require("../utils/securityLogger");
class UsersController {
    constructor(usersService) {
        this.usersService = usersService;
        this.findAll = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const role = req.query.role;
            const users = yield this.usersService.findAll(role ? { role } : undefined);
            return ApiResponse_1.ApiResponses.ok(res, users);
        }));
        this.findOne = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = yield this.usersService.findOne(req.params.id);
            if (!user) {
                throw AppError_1.AppError.notFound("User");
            }
            return ApiResponse_1.ApiResponses.ok(res, user);
        }));
        this.create = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = yield this.usersService.create(req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.USER_CREATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Users", entity_id: user.id, branch_id: user.branch_id || userInfo.branch_id, new_values: this.sanitizeUserPayload(req.body), path: req.originalUrl, method: req.method, description: `Create user ${user.username || user.id}` }));
            return ApiResponse_1.ApiResponses.created(res, user);
        }));
        this.update = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const oldUser = yield this.usersService.findOne(req.params.id);
            const user = yield this.usersService.update(req.params.id, req.body);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.USER_UPDATE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Users", entity_id: req.params.id, branch_id: user.branch_id || userInfo.branch_id, old_values: this.sanitizeUserPayload(oldUser), new_values: this.sanitizeUserPayload(req.body), path: req.originalUrl, method: req.method, description: `Update user ${user.username || user.id}` }));
            return ApiResponse_1.ApiResponses.ok(res, user);
        }));
        this.delete = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const oldUser = yield this.usersService.findOne(req.params.id);
            yield this.usersService.delete(req.params.id);
            const userInfo = (0, auditLogger_1.getUserInfoFromRequest)(req);
            yield auditLogger_1.auditLogger.log(Object.assign(Object.assign({ action_type: auditLogger_1.AuditActionType.USER_DELETE }, userInfo), { ip_address: (0, securityLogger_1.getClientIp)(req), user_agent: req.get("User-Agent"), entity_type: "Users", entity_id: req.params.id, branch_id: (oldUser === null || oldUser === void 0 ? void 0 : oldUser.branch_id) || userInfo.branch_id, old_values: this.sanitizeUserPayload(oldUser), path: req.originalUrl, method: req.method, description: `Delete user ${req.params.id}` }));
            return ApiResponse_1.ApiResponses.noContent(res);
        }));
    }
    sanitizeUserPayload(payload) {
        if (!payload || typeof payload !== "object")
            return payload;
        const { password: _password } = payload, rest = __rest(payload, ["password"]);
        return rest;
    }
}
exports.UsersController = UsersController;
