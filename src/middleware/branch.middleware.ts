import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";
import { getDbContext } from "../database/dbContext";

/**
 * Branch Context Interface
 * Extended request with branch information from authenticated user
 */
export interface BranchRequest extends AuthRequest {
    branchId?: string;
}

/**
 * Branch Middleware
 * Extracts branch_id from authenticated user and attaches to request
 * This middleware should be used after authenticateToken middleware
 */
export const extractBranch = (req: BranchRequest, res: Response, next: NextFunction) => {
    const ctx = getDbContext();
    req.branchId = ctx?.branchId || req.user?.branch_id;
    next();
};

/**
 * Require Branch Middleware
 * Ensures that the user has a branch assigned
 * Use this for endpoints that strictly require branch context
 */
export const requireBranch = (req: BranchRequest, res: Response, next: NextFunction) => {
    const ctx = getDbContext();
    const effectiveBranchId = ctx?.branchId || req.user?.branch_id;

    // Allow admin to read across branches without selecting one (GET only).
    if (!effectiveBranchId) {
        if (ctx?.isAdmin && req.method === "GET") {
            return next();
        }
        return ApiResponses.forbidden(res, "Access denied: No branch assigned/selected");
    }

    req.branchId = effectiveBranchId;
    next();
};

/**
 * Helper function to get branch_id from request
 * Used in controllers to safely extract branch_id
 */
export const getBranchId = (req: BranchRequest): string | undefined => {
    const ctx = getDbContext();
    return ctx?.branchId || req.branchId || req.user?.branch_id;
};

/**
 * Helper function to ensure branch_id exists
 * Throws error if branch_id is not available
 */
export const requireBranchId = (req: BranchRequest): string => {
    const branchId = getBranchId(req);
    if (!branchId) {
        throw new Error("Branch ID is required but not available");
    }
    return branchId;
};
