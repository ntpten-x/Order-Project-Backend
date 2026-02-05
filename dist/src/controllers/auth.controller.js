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
exports.AuthController = void 0;
const database_1 = require("../database/database");
const Users_1 = require("../entity/Users");
const Branch_1 = require("../entity/Branch");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const securityLogger_1 = require("../utils/securityLogger");
const ApiResponse_1 = require("../utils/ApiResponse");
const dbContext_1 = require("../database/dbContext");
const realtimeEvents_1 = require("../utils/realtimeEvents");
const uuid_1 = require("uuid");
const redisClient_1 = require("../lib/redisClient");
class AuthController {
    static login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
            const ip = (0, securityLogger_1.getClientIp)(req);
            try {
                const user = yield userRepository.findOne({
                    where: { username },
                    relations: ["roles"]
                });
                if (!user) {
                    securityLogger_1.securityLogger.log({
                        type: 'AUTH_FAILURE',
                        ip,
                        userAgent: req.headers['user-agent'],
                        path: req.path,
                        method: req.method,
                        details: { reason: 'User not found', username }
                    });
                    return ApiResponse_1.ApiResponses.unauthorized(res, "ไม่พบข้อมูลผู้ใช้");
                }
                // Check if user is disabled
                if (user.is_use === false) {
                    securityLogger_1.securityLogger.log({
                        type: 'UNAUTHORIZED_ACCESS',
                        userId: user.id,
                        ip,
                        userAgent: req.headers['user-agent'],
                        path: req.path,
                        method: req.method,
                        details: { reason: 'Account disabled' }
                    });
                    return ApiResponse_1.ApiResponses.forbidden(res, "บัญชีถูกปิด");
                }
                // Compare password
                // Note: In a real app, passwords should be hashed. 
                // If the DB currently has plain text passwords, this might fail if we assume hash.
                // I'll assume they are hashed with bcrypt. If not, I'll check directly or we need to hash them.
                // For safety, I'll try bcrypt.compare, invalid if not hashed.
                const isMatch = yield bcrypt_1.default.compare(password, user.password);
                if (!isMatch) {
                    securityLogger_1.securityLogger.log({
                        type: 'AUTH_FAILURE',
                        userId: user.id,
                        ip,
                        userAgent: req.headers['user-agent'],
                        path: req.path,
                        method: req.method,
                        details: { reason: 'Invalid password', username }
                    });
                    // Check for suspicious activity
                    securityLogger_1.securityLogger.checkSuspiciousActivity(user.id, ip);
                    return ApiResponse_1.ApiResponses.unauthorized(res, "ไม่พบข้อมูลผู้ใช้");
                }
                // Log successful login
                securityLogger_1.securityLogger.log({
                    type: 'AUTH_SUCCESS',
                    userId: user.id,
                    ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path,
                    method: req.method,
                    details: { username }
                });
                const role = user.roles.roles_name;
                const isAdmin = role === "Admin";
                const jti = (0, uuid_1.v4)();
                // branches table is RLS-protected; load branch under branch context
                let branch;
                if (user.branch_id) {
                    branch = yield (0, dbContext_1.runWithDbContext)({ branchId: user.branch_id, userId: user.id, role, isAdmin }, () => __awaiter(this, void 0, void 0, function* () { return (0, dbContext_1.getRepository)(Branch_1.Branch).findOneBy({ id: user.branch_id }); }));
                }
                // Generate Token
                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    return ApiResponse_1.ApiResponses.internalError(res, "Server misconfiguration: JWT_SECRET missing");
                }
                const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role, jti }, secret, { expiresIn: "10h" } // Token valid for 10 hours
                );
                // Persist session in Redis with sliding TTL
                const redis = yield (0, redisClient_1.getRedisClient)();
                if (redis) {
                    const sessionKey = (0, redisClient_1.getSessionKey)(jti);
                    const ttl = Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000;
                    yield redis.set(sessionKey, JSON.stringify({ userId: user.id, role, branchId: user.branch_id, createdAt: Date.now() }), {
                        PX: ttl,
                    });
                }
                else if (process.env.REDIS_URL) {
                    return ApiResponse_1.ApiResponses.internalError(res, "Session store unavailable");
                }
                // Set Cookie
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production", // true in production
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // None for cross-site (Render subdomains)
                    maxAge: 36000000 // 10 hours in ms
                });
                // Update last_login_at and is_active
                user.last_login_at = new Date();
                user.is_active = true;
                yield userRepository.save(user);
                // Notify via Socket
                const { SocketService } = require("../services/socket.service");
                SocketService.getInstance().emit(realtimeEvents_1.RealtimeEvents.users.status, { id: user.id, is_active: true });
                return ApiResponse_1.ApiResponses.ok(res, {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        role,
                        display_name: user.roles.display_name,
                        branch_id: user.branch_id,
                        branch: branch ? {
                            id: branch.id,
                            branch_name: branch.branch_name,
                            branch_code: branch.branch_code,
                            address: branch.address,
                            phone: branch.phone,
                            is_active: branch.is_active
                        } : undefined
                    }
                });
            }
            catch (error) {
                console.error("Login error:", error);
                return ApiResponse_1.ApiResponses.internalError(res, "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
            }
        });
    }
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let userId;
            let jti;
            // 1. Try to get from authenticated request
            if (req.user) {
                userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            }
            // 2. Fallback: Decode token from cookie (even if expired)
            else if (req.cookies && req.cookies.token) {
                try {
                    const decoded = jsonwebtoken_1.default.decode(req.cookies.token);
                    if (decoded && typeof decoded === 'object' && decoded.id) {
                        userId = decoded.id;
                        jti = decoded.jti;
                    }
                }
                catch (ignore) {
                    // Ignore decoding errors during logout
                }
            }
            if (userId) {
                try {
                    const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
                    // Set is_active to false
                    yield userRepository.update(userId, { is_active: false });
                    // Emit socket event
                    const { SocketService } = require("../services/socket.service");
                    SocketService.getInstance().emit(realtimeEvents_1.RealtimeEvents.users.status, { id: userId, is_active: false });
                }
                catch (err) {
                    console.error("Error updating logout status for user " + userId, err);
                }
            }
            // Revoke session in Redis
            if (jti) {
                const redis = yield (0, redisClient_1.getRedisClient)();
                if (redis) {
                    yield redis.del((0, redisClient_1.getSessionKey)(jti));
                }
            }
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/"
            });
            // Clear any selected admin branch context on logout to avoid stale branch selection across sessions.
            res.clearCookie("active_branch_id", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/"
            });
            return ApiResponse_1.ApiResponses.ok(res, { message: "ออกจากระบบสำเร็จ" });
        });
    }
    static getMe(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user) {
                return ApiResponse_1.ApiResponses.unauthorized(res, "ไม่พบข้อมูลผู้ใช้");
            }
            const user = req.user;
            return ApiResponse_1.ApiResponses.ok(res, {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.roles ? user.roles.roles_name : "unknown",
                display_name: user.roles ? user.roles.display_name : user.username,
                is_active: user.is_active,
                is_use: user.is_use,
                branch_id: user.branch_id,
                branch: user.branch ? {
                    id: user.branch.id,
                    branch_name: user.branch.branch_name,
                    branch_code: user.branch.branch_code,
                    address: user.branch.address,
                    phone: user.branch.phone,
                    is_active: user.branch.is_active
                } : undefined
            });
        });
    }
    /**
     * Admin-only: Switch the active branch context for RLS (stored in a cookie).
     * - branch_id = uuid: select branch context (admin sees only that branch)
     * - branch_id = null/undefined: clear selection (admin sees all branches)
     */
    static switchBranch(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (!req.user) {
                return ApiResponse_1.ApiResponses.unauthorized(res, "Authentication required");
            }
            const role = (_a = req.user.roles) === null || _a === void 0 ? void 0 : _a.roles_name;
            if (role !== "Admin") {
                return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: Admin only");
            }
            const branchId = ((_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.branch_id) !== null && _c !== void 0 ? _c : null);
            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax"),
                path: "/",
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            };
            if (!branchId) {
                res.clearCookie("active_branch_id", cookieOptions);
                return ApiResponse_1.ApiResponses.ok(res, { active_branch_id: null });
            }
            const branch = yield (0, dbContext_1.getRepository)(Branch_1.Branch).findOneBy({ id: branchId });
            if (!branch) {
                return ApiResponse_1.ApiResponses.notFound(res, "Branch");
            }
            res.cookie("active_branch_id", branchId, cookieOptions);
            return ApiResponse_1.ApiResponses.ok(res, { active_branch_id: branchId });
        });
    }
}
exports.AuthController = AuthController;
