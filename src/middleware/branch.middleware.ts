import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";
import { getDbContext } from "../database/dbContext";
import { AppDataSource } from "../database/database";

/**
 * Branch Context Interface
 * Extended request with branch information from authenticated user
 */
export interface BranchRequest extends AuthRequest {
    branchId?: string;
}

type BranchValidationCacheEntry = {
    exists: boolean;
    expiresAt: number;
};

const BRANCH_VALIDATION_CACHE_TTL_MS = Math.max(
    5_000,
    Number(process.env.BRANCH_VALIDATION_CACHE_TTL_MS || 60_000)
);
const branchValidationCache = new Map<string, BranchValidationCacheEntry>();
const BRANCH_VALIDATION_CACHE_MAX_SIZE = 1024;

function isBranchValidationCacheExpired(entry: BranchValidationCacheEntry): boolean {
    return entry.expiresAt <= Date.now();
}

function pruneBranchValidationCache(): void {
    if (branchValidationCache.size <= BRANCH_VALIDATION_CACHE_MAX_SIZE) return;
    const now = Date.now();
    for (const [key, entry] of branchValidationCache.entries()) {
        if (entry.expiresAt <= now) {
            branchValidationCache.delete(key);
        }
    }
}

async function branchExists(branchId: string): Promise<boolean> {
    const cached = branchValidationCache.get(branchId);
    if (cached && !isBranchValidationCacheExpired(cached)) {
        return cached.exists;
    }

    if (!AppDataSource.isInitialized) {
        // Avoid blocking requests during bootstrap; DB-level checks still enforce integrity.
        return true;
    }

    const rows = await AppDataSource.query(
        `SELECT 1 FROM branches WHERE id = $1 LIMIT 1`,
        [branchId]
    );
    const exists = Array.isArray(rows) && rows.length > 0;
    branchValidationCache.set(branchId, {
        exists,
        expiresAt: Date.now() + BRANCH_VALIDATION_CACHE_TTL_MS,
    });
    pruneBranchValidationCache();
    return exists;
}

function resolveCookieSecurity(req: Request): { secure: boolean; sameSite: "none" | "lax" } {
    const forwardedProtoHeader = req.headers["x-forwarded-proto"];
    const forwardedProto = Array.isArray(forwardedProtoHeader)
        ? forwardedProtoHeader[0]
        : (forwardedProtoHeader ?? "");
    const proto = forwardedProto.split(",")[0]?.trim().toLowerCase();
    const secureByRequest = req.secure || proto === "https";
    const secureOverride = process.env.COOKIE_SECURE;
    const secure =
        secureOverride === "true" ||
        (secureOverride !== "false" && secureByRequest);

    return {
        secure,
        sameSite: secure ? "none" : "lax",
    };
}

function clearActiveBranchCookie(res: Response, req: Request): void {
    const cookieSecurity = resolveCookieSecurity(req);
    res.clearCookie("active_branch_id", {
        httpOnly: true,
        secure: cookieSecurity.secure,
        sameSite: cookieSecurity.sameSite,
        path: "/",
    });
}

/**
 * Branch Middleware
 * Extracts branch_id from authenticated user and attaches to request
 * This middleware should be used after authenticateToken middleware
 */
export const extractBranch = (req: BranchRequest, res: Response, next: NextFunction) => {
    const ctx = getDbContext();

    // Admin branch context is controlled by explicit "active branch" selection (cookie -> DB context).
    // Do not fall back to the user's assigned branch_id for admins, or branch switching would be ignored.
    if (ctx?.isAdmin) {
        req.branchId = ctx.branchId;
    } else {
        req.branchId = ctx?.branchId || req.user?.branch_id;
    }
    next();
};

/**
 * Require Branch Middleware
 * Ensures that the user has a branch assigned
 * Use this for endpoints that strictly require branch context
 */
export const requireBranch = async (req: BranchRequest, res: Response, next: NextFunction) => {
    try {
        const ctx = getDbContext();
        const effectiveBranchId = ctx?.isAdmin ? ctx?.branchId : ctx?.branchId || req.user?.branch_id;

        // Allow admin to read across branches without selecting one (GET only).
        if (!effectiveBranchId) {
            if (ctx?.isAdmin && req.method === "GET") {
                return next();
            }
            return ApiResponses.forbidden(res, "Access denied: No branch assigned/selected");
        }

        const exists = await branchExists(effectiveBranchId);
        if (!exists) {
            if (ctx?.isAdmin) {
                clearActiveBranchCookie(res, req);
                return ApiResponses.forbidden(
                    res,
                    "Selected branch is invalid or deleted. Please re-select branch and retry."
                );
            }

            return ApiResponses.forbidden(
                res,
                "Assigned branch is invalid or deleted. Please contact administrator."
            );
        }

        req.branchId = effectiveBranchId;
        return next();
    } catch (error) {
        return next(error);
    }
};

/**
 * Helper function to get branch_id from request
 * Used in controllers to safely extract branch_id
 */
export const getBranchId = (req: BranchRequest): string | undefined => {
    const ctx = getDbContext();

    // Admin branch is only the explicitly selected context.
    if (ctx?.isAdmin) {
        return ctx?.branchId || req.branchId;
    }

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
