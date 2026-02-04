import { Request, Response } from "express";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/auth.middleware";
import { securityLogger, getClientIp } from "../utils/securityLogger";
import { ApiResponses } from "../utils/ApiResponse";

export class AuthController {

    static async login(req: Request, res: Response) {
        const { username, password } = req.body;
        const userRepository = AppDataSource.getRepository(Users);
        const ip = getClientIp(req);

        try {
            const user = await userRepository.findOne({
                where: { username },
                relations: ["roles", "branch"]
            });

            if (!user) {
                securityLogger.log({
                    type: 'AUTH_FAILURE',
                    ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path,
                    method: req.method,
                    details: { reason: 'User not found', username }
                });
                return ApiResponses.unauthorized(res, "ไม่พบข้อมูลผู้ใช้");
            }

            // Check if user is disabled
            if (user.is_use === false) {
                securityLogger.log({
                    type: 'UNAUTHORIZED_ACCESS',
                    userId: user.id,
                    ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path,
                    method: req.method,
                    details: { reason: 'Account disabled' }
                });
                return ApiResponses.forbidden(res, "บัญชีถูกปิด");
            }

            // Compare password
            // Note: In a real app, passwords should be hashed. 
            // If the DB currently has plain text passwords, this might fail if we assume hash.
            // I'll assume they are hashed with bcrypt. If not, I'll check directly or we need to hash them.
            // For safety, I'll try bcrypt.compare, invalid if not hashed.
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                securityLogger.log({
                    type: 'AUTH_FAILURE',
                    userId: user.id,
                    ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path,
                    method: req.method,
                    details: { reason: 'Invalid password', username }
                });

                // Check for suspicious activity
                securityLogger.checkSuspiciousActivity(user.id, ip);
                return ApiResponses.unauthorized(res, "ไม่พบข้อมูลผู้ใช้");
            }

            // Log successful login
            securityLogger.log({
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
                return ApiResponses.internalError(res, "Server misconfiguration: JWT_SECRET missing");
            }
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.roles.roles_name },
                secret,
                { expiresIn: "10h" } // Token valid for 10 hours
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
            await userRepository.save(user);

            // Notify via Socket
            const { SocketService } = require("../services/socket.service");
            SocketService.getInstance().emit('users:update-status', { id: user.id, is_active: true });

            return ApiResponses.ok(res, {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
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

        } catch (error) {
            console.error("Login error:", error);
            return ApiResponses.internalError(res, "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        }
    }

    static async logout(req: Request, res: Response) {
        let userId: string | undefined;

        // 1. Try to get from authenticated request
        if ((req as AuthRequest).user) {
            userId = (req as AuthRequest).user?.id;
        }
        // 2. Fallback: Decode token from cookie (even if expired)
        else if (req.cookies && req.cookies.token) {
            try {
                const decoded: any = jwt.decode(req.cookies.token);
                if (decoded && typeof decoded === 'object' && decoded.id) {
                    userId = decoded.id;
                }
            } catch (ignore) {
                // Ignore decoding errors during logout
            }
        }

        if (userId) {
            try {
                const userRepository = AppDataSource.getRepository(Users);
                // Set is_active to false
                await userRepository.update(userId, { is_active: false });

                // Emit socket event
                const { SocketService } = require("../services/socket.service");
                SocketService.getInstance().emit('users:update-status', { id: userId, is_active: false });
            } catch (err) {
                console.error("Error updating logout status for user " + userId, err);
            }
        }

        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/"
        });
        return ApiResponses.ok(res, { message: "ออกจากระบบสำเร็จ" });
    }

    static async getMe(req: AuthRequest, res: Response) {
        if (!req.user) {
            return ApiResponses.unauthorized(res, "ไม่พบข้อมูลผู้ใช้");
        }

        const user = req.user;
        return ApiResponses.ok(res, {
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
    }
}
