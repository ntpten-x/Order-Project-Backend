"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireBranchId = exports.getBranchId = exports.requireBranch = exports.extractBranch = void 0;
/**
 * Branch Middleware
 * Extracts branch_id from authenticated user and attaches to request
 * This middleware should be used after authenticateToken middleware
 */
const extractBranch = (req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id) {
        req.branchId = req.user.branch_id;
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
    if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id)) {
        return res.status(403).json({
            message: "Access denied: No branch assigned to user",
            code: "NO_BRANCH_ASSIGNED"
        });
    }
    req.branchId = req.user.branch_id;
    next();
};
exports.requireBranch = requireBranch;
/**
 * Helper function to get branch_id from request
 * Used in controllers to safely extract branch_id
 */
const getBranchId = (req) => {
    var _a;
    return req.branchId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.branch_id);
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
