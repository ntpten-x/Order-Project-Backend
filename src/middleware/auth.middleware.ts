import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import { securityLogger, getClientIp } from "../utils/securityLogger";
import { runWithDbContext } from "../database/dbContext";
import { ApiResponses } from "../utils/ApiResponse";

export interface AuthRequest extends Request {
    user?: Users;
    tokenExpiry?: number;
}

// Session timeout in milliseconds (default: 8 hours)
const SESSION_TIMEOUT = Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000;

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Get token from cookies
    let token = req.cookies?.token;

    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        const ip = getClientIp(req);
        securityLogger.log({
            type: 'UNAUTHORIZED_ACCESS',
            ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            details: { reason: 'No token provided' }
        });
        return ApiResponses.unauthorized(res, "Authentication required");
    }

    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return ApiResponses.internalError(res, "Server misconfiguration: JWT_SECRET missing");
        }
        const decoded: any = jwt.verify(token, secret);

        // Check token expiry (session timeout)
        const now = Date.now();
        const tokenIssuedAt = decoded.iat ? decoded.iat * 1000 : now;
        const tokenAge = now - tokenIssuedAt;

        if (tokenAge > SESSION_TIMEOUT) {
            const ip = getClientIp(req);
            securityLogger.log({
                type: 'TOKEN_EXPIRED',
                userId: decoded.id,
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { tokenAge, sessionTimeout: SESSION_TIMEOUT }
            });
            return ApiResponses.unauthorized(res, "Session expired. Please login again.");
        }

        // 3. Attach user to request (including branch relation for branch-based filtering)
        const userRepository = AppDataSource.getRepository(Users);
        const user = await userRepository.findOne({
            where: { id: decoded.id },
            relations: ["roles", "branch"]
        });

        if (!user) {
            const ip = getClientIp(req);
            securityLogger.log({
                type: 'AUTH_FAILURE',
                userId: decoded.id,
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'User not found' }
            });
            return ApiResponses.unauthorized(res, "User not found");
        }
        if (!user.is_use) {
            const ip = getClientIp(req);
            securityLogger.log({
                type: 'UNAUTHORIZED_ACCESS',
                userId: user.id,
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'Account disabled' }
            });
            return ApiResponses.forbidden(res, "Account disabled");
        }

        req.user = user;
        req.tokenExpiry = tokenIssuedAt + SESSION_TIMEOUT;

        const role = user.roles?.roles_name;
        const isAdmin = role === "Admin";

        // Run the rest of the request inside a DB context so Postgres RLS (if enabled)
        // can enforce branch isolation even if a future query forgets branch_id filters.
        return runWithDbContext(
            { branchId: user.branch_id, userId: user.id, role, isAdmin },
            async () => {
                await new Promise<void>((resolve) => {
                    const done = () => resolve();
                    res.once("finish", done);
                    res.once("close", done);
                    next();
                });
            }
        ).catch(next);
    } catch (err) {
        const ip = getClientIp(req);
        if (err instanceof jwt.JsonWebTokenError) {
            securityLogger.log({
                type: 'AUTH_FAILURE',
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'Invalid token', error: err.message }
            });
            return ApiResponses.unauthorized(res, "Invalid or expired token");
        }
        if (err instanceof jwt.TokenExpiredError) {
            securityLogger.log({
                type: 'TOKEN_EXPIRED',
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'Token expired' }
            });
            return ApiResponses.unauthorized(res, "Token expired");
        }
        console.error("Authentication Error (System):", err);
        securityLogger.log({
            type: 'AUTH_FAILURE',
            ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            details: { reason: 'System error', error: (err as any).message }
        });
        return ApiResponses.internalError(res, "Authentication system error", { error: (err as any).message });
    }
};

export const authorizeRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        const userRole = req.user.roles?.roles_name;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return ApiResponses.forbidden(res, "Access denied: Insufficient permissions");
        }

        next();
    };
};
