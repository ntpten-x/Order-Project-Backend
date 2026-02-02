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
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const securityLogger_1 = require("../utils/securityLogger");
class AuthController {
    static login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { username, password } = req.body;
            const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
            const ip = (0, securityLogger_1.getClientIp)(req);
            try {
                const user = yield userRepository.findOne({
                    where: { username },
                    relations: ["roles", "branch"]
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
                    return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
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
                    return res.status(403).json({ message: "บัญชีถูกปิด" });
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
                    return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
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
                // Generate Token
                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    return res.status(500).json({ message: "Server misconfiguration: JWT_SECRET missing" });
                }
                const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, role: user.roles.roles_name }, secret, { expiresIn: "10h" } // Token valid for 10 hours
                );
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
                SocketService.getInstance().emit('users:update-status', { id: user.id, is_active: true });
                return res.status(200).json({
                    message: "เข้าสู่ระบบสำเร็จ",
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.roles.roles_name,
                        display_name: user.roles.display_name,
                        branch_id: user.branch_id,
                        branch: user.branch ? {
                            id: user.branch.id,
                            branch_name: user.branch.branch_name,
                            branch_code: user.branch.branch_code,
                            address: user.branch.address,
                            phone: user.branch.phone,
                            is_active: user.branch.is_active
                        } : undefined
                    }
                });
            }
            catch (error) {
                console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ:", error);
                return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
            }
        });
    }
    static logout(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let userId;
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
                    SocketService.getInstance().emit('users:update-status', { id: userId, is_active: false });
                }
                catch (err) {
                    console.error("Error updating logout status for user " + userId, err);
                }
            }
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: "/"
            });
            return res.status(200).json({ message: "ออกจากระบบสำเร็จ" });
        });
    }
    static getMe(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!req.user) {
                return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
            }
            const user = req.user;
            return res.json({
                id: user.id,
                username: user.username,
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
}
exports.AuthController = AuthController;
