import { Request, Response } from "express";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import { Branch } from "../entity/Branch";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/auth.middleware";
import { securityLogger, getClientIp } from "../utils/securityLogger";
import { ApiResponses } from "../utils/ApiResponse";
import { getRepository, runWithDbContext } from "../database/dbContext";
import { RealtimeEvents } from "../utils/realtimeEvents";
import { v4 as uuidv4 } from "uuid";
import { getRedisClient, getSessionKey, isRedisConfigured } from "../lib/redisClient";
import { normalizeRoleName } from "../utils/role";

export class AuthController {
    private static resolveCookieSecurity(req: Request): { secure: boolean; sameSite: "none" | "lax" } {
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

    private static setNoStoreHeaders(res: Response): void {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Vary", "Authorization, Cookie");
    }

    static async login(req: Request, res: Response) {
        AuthController.setNoStoreHeaders(res);
        const { username, password } = req.body;
        const userRepository = AppDataSource.getRepository(Users);
        const ip = getClientIp(req);

        try {
            const user = await userRepository.findOne({
                where: { username },
                relations: ["roles"]
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

            const role = normalizeRoleName(user.roles?.roles_name);
            if (!role) {
                return ApiResponses.forbidden(res, "Invalid role configuration");
            }
            user.roles.roles_name = role;
            const isAdmin = role === "Admin";
            const jti = uuidv4();

            // branches table is RLS-protected; load branch under branch context
            let branch: Branch | null | undefined;
            if (user.branch_id) {
                branch = await runWithDbContext(
                    { branchId: user.branch_id, userId: user.id, role, isAdmin },
                    async () => getRepository(Branch).findOneBy({ id: user.branch_id! })
                );
            }

            // Generate Token
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return ApiResponses.internalError(res, "Server misconfiguration: JWT_SECRET missing");
            }
            const token = jwt.sign(
                { id: user.id, username: user.username, role, jti },
                secret,
                { expiresIn: "10h" } // Token valid for 10 hours
            );

            // Persist session in Redis with sliding TTL
            const redis = await getRedisClient();
            if (redis) {
                const sessionKey = getSessionKey(jti);
                const ttl = Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000;
                await redis.set(
                    sessionKey,
                    JSON.stringify({
                        userId: user.id,
                        username: user.username,
                        name: user.name ?? null,
                        role,
                        roleDisplayName: user.roles?.display_name ?? role,
                        rolesId: user.roles_id,
                        branchId: user.branch_id ?? null,
                        isUse: user.is_use,
                        isActive: user.is_active,
                        createdAt: Date.now(),
                        lastValidatedAt: Date.now(),
                    }),
                    { PX: ttl }
                );
            } else if (isRedisConfigured()) {
                return ApiResponses.internalError(res, "Session store unavailable");
            }

            // Set Cookie
            const cookieSecurity = AuthController.resolveCookieSecurity(req);
            res.cookie("token", token, {
                httpOnly: true,
                secure: cookieSecurity.secure,
                sameSite: cookieSecurity.sameSite,
                maxAge: 36000000 // 10 hours in ms
            });

            // Update last_login_at and is_active
            user.last_login_at = new Date();
            user.is_active = true;
            await userRepository.save(user);

            // Notify via Socket
            const { SocketService } = require("../services/socket.service");
            SocketService.getInstance().emit(RealtimeEvents.users.status, { id: user.id, is_active: true });

            return ApiResponses.ok(res, {
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

        } catch (error) {
            console.error("Login error:", error);
            return ApiResponses.internalError(res, "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        }
    }

    static async logout(req: Request, res: Response) {
        AuthController.setNoStoreHeaders(res);
        let userId: string | undefined;
        let jti: string | undefined;

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
                    jti = decoded.jti;
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
                SocketService.getInstance().emit(RealtimeEvents.users.status, { id: userId, is_active: false });
            } catch (err) {
                console.error("Error updating logout status for user " + userId, err);
            }
        }

        // Revoke session in Redis
        if (jti) {
            const redis = await getRedisClient();
            if (redis) {
                await redis.del(getSessionKey(jti));
            }
        }

        const cookieSecurity = AuthController.resolveCookieSecurity(req);
        res.clearCookie("token", {
            httpOnly: true,
            secure: cookieSecurity.secure,
            sameSite: cookieSecurity.sameSite,
            path: "/"
        });
        // Clear any selected admin branch context on logout to avoid stale branch selection across sessions.
        res.clearCookie("active_branch_id", {
            httpOnly: true,
            secure: cookieSecurity.secure,
            sameSite: cookieSecurity.sameSite,
            path: "/"
        });
        return ApiResponses.ok(res, { message: "ออกจากระบบสำเร็จ" });
    }

    static async getMe(req: AuthRequest, res: Response) {
        AuthController.setNoStoreHeaders(res);
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

    static async updateMe(req: AuthRequest, res: Response) {
        AuthController.setNoStoreHeaders(res);
        if (!req.user?.id) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

        const userRepository = AppDataSource.getRepository(Users);
        const user = await userRepository.findOne({
            where: { id: req.user.id },
            relations: ["roles", "branch"],
        });

        if (!user) {
            return ApiResponses.notFound(res, "User");
        }

        const { name, password } = req.body ?? {};

        if (typeof name === "string") {
            user.name = name.trim();
        }

        if (typeof password === "string" && password.length > 0) {
            user.password = await bcrypt.hash(password, 10);
        }

        await userRepository.save(user);

        const role = normalizeRoleName(user.roles?.roles_name) || "unknown";

        return ApiResponses.ok(res, {
            id: user.id,
            username: user.username,
            name: user.name,
            role,
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

    /**
     * Admin-only: Switch the active branch context for RLS (stored in a cookie).
     * - branch_id = uuid: select branch context (admin sees only that branch)
     * - branch_id = null/undefined: clear selection (admin sees all branches)
     */
    static async switchBranch(req: AuthRequest, res: Response) {
        AuthController.setNoStoreHeaders(res);
        if (!req.user) {
            return ApiResponses.unauthorized(res, "Authentication required");
        }

            const role = normalizeRoleName(req.user.roles?.roles_name);
            if (role !== "Admin") {
                return ApiResponses.forbidden(res, "Access denied: Admin only");
            }

        const branchId = (req.body?.branch_id ?? null) as string | null;

        const cookieSecurity = AuthController.resolveCookieSecurity(req);
        const cookieOptions = {
            httpOnly: true,
            secure: cookieSecurity.secure,
            sameSite: cookieSecurity.sameSite,
            path: "/",
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        };

        if (!branchId) {
            res.clearCookie("active_branch_id", cookieOptions);
            return ApiResponses.ok(res, { active_branch_id: null });
        }

        const branch = await getRepository(Branch).findOneBy({ id: branchId });
        if (!branch) {
            return ApiResponses.notFound(res, "Branch");
        }

        res.cookie("active_branch_id", branchId, cookieOptions);
        return ApiResponses.ok(res, { active_branch_id: branchId });
    }
}
