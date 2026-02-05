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
exports.enforceUserManagementPolicy = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const dbContext_1 = require("../database/dbContext");
const Roles_1 = require("../entity/Roles");
const Users_1 = require("../entity/Users");
const ROLE_ADMIN = "Admin";
const ROLE_MANAGER = "Manager";
const ROLE_EMPLOYEE = "Employee";
function getRoleNameById(rolesId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!rolesId || typeof rolesId !== "string")
            return null;
        const role = yield (0, dbContext_1.getRepository)(Roles_1.Roles).findOne({ where: { id: rolesId } });
        return (_a = role === null || role === void 0 ? void 0 : role.roles_name) !== null && _a !== void 0 ? _a : null;
    });
}
let employeeRoleIdPromise = null;
function getEmployeeRoleId() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!employeeRoleIdPromise) {
            employeeRoleIdPromise = (() => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const byName = yield (0, dbContext_1.getRepository)(Roles_1.Roles).findOne({ where: { roles_name: ROLE_EMPLOYEE } });
                if (byName === null || byName === void 0 ? void 0 : byName.id)
                    return byName.id;
                const byDisplay = yield (0, dbContext_1.getRepository)(Roles_1.Roles).findOne({ where: { display_name: ROLE_EMPLOYEE } });
                return (_a = byDisplay === null || byDisplay === void 0 ? void 0 : byDisplay.id) !== null && _a !== void 0 ? _a : null;
            }))();
        }
        return employeeRoleIdPromise;
    });
}
function getUserRoleName(req) {
    var _a, _b;
    return (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.roles_name;
}
/**
 * Manager constraints for /users endpoints:
 * - Can CRUD only `Employee` users in their own branch context (enforced by DB context + extra checks below).
 * - Can update self (limited fields) but cannot change role/branch/flags.
 * - Cannot create/update/delete Admin/Manager users.
 */
const enforceUserManagementPolicy = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const actorRole = getUserRoleName(req);
    if (!actorRole) {
        return ApiResponse_1.ApiResponses.unauthorized(res, "Authentication required");
    }
    // Admin: unrestricted
    if (actorRole === ROLE_ADMIN)
        return next();
    // Non-manager roles have no business touching /users routes.
    if (actorRole !== ROLE_MANAGER) {
        return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: Insufficient permissions");
    }
    const method = req.method.toUpperCase();
    // Manager can list/read within branch (branch scoping is enforced by DB context / queries).
    if (method === "GET")
        return next();
    // Manager can create employees only.
    if (method === "POST") {
        const ctx = (0, dbContext_1.getDbContext)();
        if (!(ctx === null || ctx === void 0 ? void 0 : ctx.branchId)) {
            return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: No branch assigned");
        }
        const employeeRoleId = yield getEmployeeRoleId();
        if (!employeeRoleId) {
            return ApiResponse_1.ApiResponses.internalError(res, "Employee role is not configured");
        }
        const requestedRoleId = (_a = req.body) === null || _a === void 0 ? void 0 : _a.roles_id;
        if (requestedRoleId) {
            const requestedRoleName = yield getRoleNameById(requestedRoleId);
            if (requestedRoleName !== ROLE_EMPLOYEE) {
                return ApiResponse_1.ApiResponses.forbidden(res, "Managers can only create Employee users");
            }
        }
        // Enforce branch + role regardless of client payload.
        req.body.branch_id = ctx.branchId;
        req.body.roles_id = employeeRoleId;
        return next();
    }
    // For updates/deletes, validate target user role.
    const targetUserId = (_b = req.params) === null || _b === void 0 ? void 0 : _b.id;
    if (!targetUserId)
        return ApiResponse_1.ApiResponses.badRequest(res, "User id is required");
    const targetUser = yield (0, dbContext_1.getRepository)(Users_1.Users).findOne({
        where: { id: targetUserId },
        relations: ["roles"],
    });
    if (!targetUser) {
        return ApiResponse_1.ApiResponses.notFound(res, "User");
    }
    // Allow manager to update self, but not elevate/change system fields.
    if (targetUser.id === ((_c = req.user) === null || _c === void 0 ? void 0 : _c.id)) {
        if (method === "PUT" || method === "PATCH") {
            const body = ((_d = req.body) !== null && _d !== void 0 ? _d : {});
            const forbiddenFields = ["roles_id", "branch_id", "is_use", "is_active"];
            const hasForbidden = forbiddenFields.some((field) => body[field] !== undefined);
            if (hasForbidden) {
                return ApiResponse_1.ApiResponses.forbidden(res, "Managers cannot change role/branch/status fields");
            }
            return next();
        }
        return ApiResponse_1.ApiResponses.forbidden(res, "Managers cannot delete their own account");
    }
    const targetRoleName = (_e = targetUser.roles) === null || _e === void 0 ? void 0 : _e.roles_name;
    if (targetRoleName !== ROLE_EMPLOYEE) {
        return ApiResponse_1.ApiResponses.forbidden(res, "Managers can only manage Employee users");
    }
    if (method === "PUT" || method === "PATCH") {
        const ctx = (0, dbContext_1.getDbContext)();
        if (!(ctx === null || ctx === void 0 ? void 0 : ctx.branchId)) {
            return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: No branch assigned");
        }
        const employeeRoleId = yield getEmployeeRoleId();
        if (!employeeRoleId) {
            return ApiResponse_1.ApiResponses.internalError(res, "Employee role is not configured");
        }
        const requestedRoleId = (_f = req.body) === null || _f === void 0 ? void 0 : _f.roles_id;
        if (requestedRoleId) {
            const requestedRoleName = yield getRoleNameById(requestedRoleId);
            if (requestedRoleName !== ROLE_EMPLOYEE) {
                return ApiResponse_1.ApiResponses.forbidden(res, "Managers cannot change user role to Admin/Manager");
            }
        }
        // Enforce branch + role regardless of client payload.
        req.body.branch_id = ctx.branchId;
        req.body.roles_id = employeeRoleId;
    }
    return next();
});
exports.enforceUserManagementPolicy = enforceUserManagementPolicy;
