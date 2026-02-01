import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import { securityLogger, getClientIp } from "../utils/securityLogger";

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
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ message: "Server misconfiguration: JWT_SECRET missing" });
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
            return res.status(401).json({ message: "Session expired. Please login again." });
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
            return res.status(401).json({ message: "User not found" });
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
            return res.status(403).json({ message: "Account disabled" });
        }

        req.user = user;
        req.tokenExpiry = tokenIssuedAt + SESSION_TIMEOUT;
        next();
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
            return res.status(403).json({ message: "Invalid or expired token" });
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
            return res.status(403).json({ message: "Token expired" });
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
        return res.status(500).json({ message: "Authentication system error", error: (err as any).message });
    }
};

export const authorizeRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const userRole = req.user.roles?.roles_name;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: "Access denied: Insufficient permissions" });
        }

        next();
    };
};
