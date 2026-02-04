"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireBranchId = exports.getBranchId = exports.requireBranch = exports.extractBranch = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const dbContext_1 = require("../database/dbContext");
/**
 * Branch Middleware
 * Extracts branch_id from authenticated user and attaches to request
 * This middleware should be used after authenticateToken middleware
 */
const extractBranch = (req, res, next) => {
    var _a;
    const ctx = (0, dbContext_1.getDbContext)();
    // Admin branch context is controlled by explicit "active branch" selection (cookie -> DB context).
    // Do not fall back to the user's assigned branch_id for admins, or branch switching would be ignored.
    if (ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin) {
        req.branchId = ctx.branchId;
    }
    else {
        req.branchId = (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id);
    }
    next();
};
exports.extractBranch = extractBranch;
/**
 * Require Branch Middleware
 * Ensures that the user has a branch assigned
 * Use this for endpoints that strictly require branch context
 */
const requireBranch = (req, res, next) => {
    var _a;
    const ctx = (0, dbContext_1.getDbContext)();
    const effectiveBranchId = (ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin) ? ctx === null || ctx === void 0 ? void 0 : ctx.branchId : (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id);
    // Allow admin to read across branches without selecting one (GET only).
    if (!effectiveBranchId) {
        if ((ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin) && req.method === "GET") {
            return next();
        }
        return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: No branch assigned/selected");
    }
    req.branchId = effectiveBranchId;
    next();
};
exports.requireBranch = requireBranch;
/**
 * Helper function to get branch_id from request
 * Used in controllers to safely extract branch_id
 */
const getBranchId = (req) => {
    var _a;
    const ctx = (0, dbContext_1.getDbContext)();
    // Admin branch is only the explicitly selected context.
    if (ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin) {
        return (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) || req.branchId;
    }
    return (ctx === null || ctx === void 0 ? void 0 : ctx.branchId) || req.branchId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id);
};
exports.getBranchId = getBranchId;
/**
 * Helper function to ensure branch_id exists
 * Throws error if branch_id is not available
 */
const requireBranchId = (req) => {
    const branchId = (0, exports.getBranchId)(req);
    if (!branchId) {
        throw new Error("Branch ID is required but not available");
    }
    return branchId;
};
exports.requireBranchId = requireBranchId;
