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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../database/database");
const Users_1 = require("../entity/Users");
const Branch_1 = require("../entity/Branch");
const securityLogger_1 = require("../utils/securityLogger");
const dbContext_1 = require("../database/dbContext");
const ApiResponse_1 = require("../utils/ApiResponse");
const redisClient_1 = require("../lib/redisClient");
// Session timeout in milliseconds (default: 8 hours)
const SESSION_TIMEOUT = Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const authenticateToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    // 1. Get token from cookies
    let token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.token;
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        const ip = (0, securityLogger_1.getClientIp)(req);
        securityLogger_1.securityLogger.log({
            type: 'UNAUTHORIZED_ACCESS',
            ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            details: { reason: 'No token provided' }
        });
        return ApiResponse_1.ApiResponses.unauthorized(res, "Authentication required");
    }
    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return ApiResponse_1.ApiResponses.internalError(res, "Server misconfiguration: JWT_SECRET missing");
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const jti = decoded.jti;
        if (!jti) {
            return ApiResponse_1.ApiResponses.unauthorized(res, "Session invalid");
        }
        const redis = yield (0, redisClient_1.getRedisClient)();
        if (redis) {
            const sessionKey = (0, redisClient_1.getSessionKey)(jti);
            const sessionJson = yield redis.get(sessionKey);
            if (!sessionJson) {
                return ApiResponse_1.ApiResponses.unauthorized(res, "Session expired or revoked");
            }
            try {
                const session = JSON.parse(sessionJson);
                if (session.userId && session.userId !== decoded.id) {
                    return ApiResponse_1.ApiResponses.unauthorized(res, "Session mismatch");
                }
            }
            catch (_d) {
                return ApiResponse_1.ApiResponses.unauthorized(res, "Session invalid");
            }
            // Sliding expiration: refresh TTL to session timeout
            yield redis.pExpire(sessionKey, SESSION_TIMEOUT);
        }
        else if (process.env.REDIS_URL) {
            // If Redis URL is configured but client unavailable, fail closed
            return ApiResponse_1.ApiResponses.internalError(res, "Session store unavailable");
        }
        // Check token expiry (session timeout)
        const now = Date.now();
        const tokenIssuedAt = decoded.iat ? decoded.iat * 1000 : now;
        const tokenAge = now - tokenIssuedAt;
        if (tokenAge > SESSION_TIMEOUT) {
            const ip = (0, securityLogger_1.getClientIp)(req);
            securityLogger_1.securityLogger.log({
                type: 'TOKEN_EXPIRED',
                userId: decoded.id,
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { tokenAge, sessionTimeout: SESSION_TIMEOUT }
            });
            return ApiResponse_1.ApiResponses.unauthorized(res, "Session expired. Please login again.");
        }
        // 3. Attach user to request
        const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
        const user = yield userRepository.findOne({
            where: { id: decoded.id },
            relations: ["roles"]
        });
        if (!user) {
            const ip = (0, securityLogger_1.getClientIp)(req);
            securityLogger_1.securityLogger.log({
                type: 'AUTH_FAILURE',
                userId: decoded.id,
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'User not found' }
            });
            return ApiResponse_1.ApiResponses.unauthorized(res, "User not found");
        }
        if (!user.is_use) {
            const ip = (0, securityLogger_1.getClientIp)(req);
            securityLogger_1.securityLogger.log({
                type: 'UNAUTHORIZED_ACCESS',
                userId: user.id,
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'Account disabled' }
            });
            return ApiResponse_1.ApiResponses.forbidden(res, "Account disabled");
        }
        const role = (_b = user.roles) === null || _b === void 0 ? void 0 : _b.roles_name;
        const isAdmin = role === "Admin";
        // Admin branch switching:
        // - Non-admins are always scoped to their own branch_id.
        // - Admins can optionally set a selected branch via the "active_branch_id" cookie.
        //   If not set, admin operates with no branch context (RLS allows full access).
        const cookieBranchIdRaw = typeof ((_c = req.cookies) === null || _c === void 0 ? void 0 : _c.active_branch_id) === "string" ? req.cookies.active_branch_id : "";
        const cookieBranchId = cookieBranchIdRaw.trim();
        const effectiveBranchId = isAdmin ? (cookieBranchId && UUID_RE.test(cookieBranchId) ? cookieBranchId : user.branch_id) : user.branch_id;
        // Run the rest of the request inside a DB context so Postgres RLS (if enabled)
        // can enforce branch isolation even if a future query forgets branch_id filters.
        return (0, dbContext_1.runWithDbContext)({ branchId: effectiveBranchId, userId: user.id, role, isAdmin }, () => __awaiter(void 0, void 0, void 0, function* () {
            if (user.branch_id) {
                const branch = yield (0, dbContext_1.getRepository)(Branch_1.Branch).findOneBy({ id: user.branch_id });
                if (branch)
                    user.branch = branch;
            }
            req.user = user;
            req.tokenExpiry = tokenIssuedAt + SESSION_TIMEOUT;
            yield new Promise((resolve) => {
                const done = () => resolve();
                res.once("finish", done);
                res.once("close", done);
                next();
            });
        })).catch(next);
    }
    catch (err) {
        const ip = (0, securityLogger_1.getClientIp)(req);
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            securityLogger_1.securityLogger.log({
                type: 'AUTH_FAILURE',
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'Invalid token', error: err.message }
            });
            return ApiResponse_1.ApiResponses.unauthorized(res, "Invalid or expired token");
        }
        if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
            securityLogger_1.securityLogger.log({
                type: 'TOKEN_EXPIRED',
                ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: { reason: 'Token expired' }
            });
            return ApiResponse_1.ApiResponses.unauthorized(res, "Token expired");
        }
        console.error("Authentication Error (System):", err);
        securityLogger_1.securityLogger.log({
            type: 'AUTH_FAILURE',
            ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            details: { reason: 'System error', error: err.message }
        });
        return ApiResponse_1.ApiResponses.internalError(res, "Authentication system error", { error: err.message });
    }
});
exports.authenticateToken = authenticateToken;
const authorizeRole = (allowedRoles) => {
    return (req, res, next) => {
        var _a;
        if (!req.user) {
            return ApiResponse_1.ApiResponses.unauthorized(res, "Authentication required");
        }
        const userRole = (_a = req.user.roles) === null || _a === void 0 ? void 0 : _a.roles_name;
        if (!userRole || !allowedRoles.includes(userRole)) {
            return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: Insufficient permissions");
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
