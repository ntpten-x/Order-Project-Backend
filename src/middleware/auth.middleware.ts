import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import { securityLogger, getClientIp } from "../utils/securityLogger";
import { runWithDbContext } from "../database/dbContext";
import { ApiResponses } from "../utils/ApiResponse";
import { getRedisClient, getSessionKey, isRedisConfigured } from "../lib/redisClient";
import { normalizeRoleName } from "../utils/role";
import type { RequestPermission } from "./permission.middleware";

export interface AuthRequest extends Request {
    user?: Users;
    tokenExpiry?: number;
    permission?: RequestPermission;
}

// Session timeout in milliseconds (default: 8 hours)
const SESSION_TIMEOUT = Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000;
const AUTH_USER_DB_REVALIDATE_MS = Number(process.env.AUTH_USER_DB_REVALIDATE_MS || 5 * 60 * 1000);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AuthSessionRecord = {
    userId?: string;
    username?: string;
    name?: string | null;
    role?: string;
    roleDisplayName?: string;
    rolesId?: string;
    branchId?: string | null;
    isUse?: boolean;
    isActive?: boolean;
    createdAt?: number;
    lastValidatedAt?: number;
};

type AuthUserSnapshot = {
    id: string;
    username: string;
    name: string | null;
    rolesId: string;
    roleName: string;
    roleDisplayName: string;
    branchId: string | null;
    isUse: boolean;
    isActive: boolean;
};

type LocalAuthSessionCacheEntry = {
    snapshot: AuthUserSnapshot;
    expiresAt: number;
};

function toBoolean(value: unknown): boolean {
    if (value === true || value === "true" || value === 1 || value === "1" || value === "t") return true;
    return false;
}

function toUsersFromSnapshot(snapshot: AuthUserSnapshot): Users {
    return {
        id: snapshot.id,
        username: snapshot.username,
        name: snapshot.name ?? undefined,
        roles_id: snapshot.rolesId,
        branch_id: snapshot.branchId ?? undefined,
        is_use: snapshot.isUse,
        is_active: snapshot.isActive,
        roles: {
            id: snapshot.rolesId,
            roles_name: snapshot.roleName,
            display_name: snapshot.roleDisplayName,
        } as any,
    } as Users;
}

async function getSessionWithSlidingTtl(redis: any, sessionKey: string): Promise<string | null> {
    if (typeof redis.getEx === "function") {
        try {
            return await redis.getEx(sessionKey, { PX: SESSION_TIMEOUT });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!/unknown command|wrong number of arguments/i.test(message)) {
                throw error;
            }
        }
    }

    const sessionJson = await redis.get(sessionKey);
    if (sessionJson) {
        await redis.pExpire(sessionKey, SESSION_TIMEOUT);
    }
    return sessionJson;
}

async function loadAuthUserSnapshot(userId: string): Promise<AuthUserSnapshot | null> {
    const row = await AppDataSource.getRepository(Users)
        .createQueryBuilder("u")
        .leftJoin("u.roles", "r")
        .select("u.id", "id")
        .addSelect("u.username", "username")
        .addSelect("u.name", "name")
        .addSelect("u.roles_id", "rolesId")
        .addSelect("u.branch_id", "branchId")
        .addSelect("u.is_use", "isUse")
        .addSelect("u.is_active", "isActive")
        .addSelect("r.roles_name", "roleName")
        .addSelect("r.display_name", "roleDisplayName")
        .where("u.id = :userId", { userId })
        .getRawOne<{
            id: string;
            username: string;
            name: string | null;
            rolesId: string;
            branchId: string | null;
            isUse: boolean | string | number;
            isActive: boolean | string | number;
            roleName: string;
            roleDisplayName: string;
        }>();

    if (!row) return null;
    const normalizedRole = normalizeRoleName(row.roleName);
    if (!normalizedRole) return null;

    return {
        id: row.id,
        username: row.username,
        name: row.name ?? null,
        rolesId: row.rolesId,
        roleName: normalizedRole,
        roleDisplayName: row.roleDisplayName || normalizedRole,
        branchId: row.branchId ?? null,
        isUse: toBoolean(row.isUse),
        isActive: toBoolean(row.isActive),
    };
}

// Cache session snapshots briefly to reduce Redis/DB round-trips on read-heavy traffic.
// Keep the window small to avoid delaying revocation/role updates too long.
const AUTH_SESSION_LOCAL_CACHE_TTL_MS = Number(process.env.AUTH_SESSION_LOCAL_CACHE_TTL_MS || 60_000);
const AUTH_SESSION_LOCAL_CACHE_MAX_ENTRIES = Number(process.env.AUTH_SESSION_LOCAL_CACHE_MAX_ENTRIES || 2_000);
const authSessionLocalCache = new Map<string, LocalAuthSessionCacheEntry>();

function readLocalSessionSnapshot(jti: string): AuthUserSnapshot | null {
    if (AUTH_SESSION_LOCAL_CACHE_TTL_MS <= 0) return null;

    const hit = authSessionLocalCache.get(jti);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
        authSessionLocalCache.delete(jti);
        return null;
    }

    authSessionLocalCache.delete(jti);
    authSessionLocalCache.set(jti, hit);
    return hit.snapshot;
}

function writeLocalSessionSnapshot(jti: string, snapshot: AuthUserSnapshot): void {
    if (AUTH_SESSION_LOCAL_CACHE_TTL_MS <= 0) return;

    while (authSessionLocalCache.size >= AUTH_SESSION_LOCAL_CACHE_MAX_ENTRIES) {
        const oldestKey = authSessionLocalCache.keys().next().value;
        if (!oldestKey) break;
        authSessionLocalCache.delete(oldestKey);
    }

    authSessionLocalCache.set(jti, {
        snapshot,
        expiresAt: Date.now() + AUTH_SESSION_LOCAL_CACHE_TTL_MS,
    });
}

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
        const jti = decoded.jti;
        if (!jti) {
            return ApiResponses.unauthorized(res, "Session invalid");
        }

        let userSnapshot: AuthUserSnapshot | null = null;
        const localSnapshot = readLocalSessionSnapshot(jti);
        if (localSnapshot) {
            userSnapshot = localSnapshot;
        }

        if (!userSnapshot) {
            const redis = await getRedisClient();

            if (redis) {
                const sessionKey = getSessionKey(jti);
                const sessionJson = await getSessionWithSlidingTtl(redis, sessionKey);
                if (!sessionJson) {
                    authSessionLocalCache.delete(jti);
                    return ApiResponses.unauthorized(res, "Session expired or revoked");
                }

                let session: AuthSessionRecord;
                try {
                    session = JSON.parse(sessionJson) as AuthSessionRecord;
                } catch {
                    authSessionLocalCache.delete(jti);
                    return ApiResponses.unauthorized(res, "Session invalid");
                }

                if (session.userId && session.userId !== decoded.id) {
                    authSessionLocalCache.delete(jti);
                    return ApiResponses.unauthorized(res, "Session mismatch");
                }

                const normalizedSessionRole = normalizeRoleName(session.role);
                const sessionIncomplete =
                    !normalizedSessionRole ||
                    !session.rolesId ||
                    !session.username ||
                    typeof session.isUse !== "boolean" ||
                    typeof session.isActive !== "boolean";
                const lastValidatedAt = Number(session.lastValidatedAt || 0);
                const shouldRevalidateFromDb =
                    sessionIncomplete ||
                    AUTH_USER_DB_REVALIDATE_MS <= 0 ||
                    !Number.isFinite(lastValidatedAt) ||
                    Date.now() - lastValidatedAt >= AUTH_USER_DB_REVALIDATE_MS;

                if (shouldRevalidateFromDb) {
                    const freshSnapshot = await loadAuthUserSnapshot(decoded.id);
                    if (!freshSnapshot) {
                        await redis.del(sessionKey);
                        authSessionLocalCache.delete(jti);
                        return ApiResponses.unauthorized(res, "User not found");
                    }
                    if (!freshSnapshot.isUse) {
                        await redis.del(sessionKey);
                        authSessionLocalCache.delete(jti);
                        return ApiResponses.forbidden(res, "Account disabled");
                    }

                    userSnapshot = freshSnapshot;
                    const updatedSession: AuthSessionRecord = {
                        ...session,
                        userId: freshSnapshot.id,
                        username: freshSnapshot.username,
                        name: freshSnapshot.name ?? null,
                        role: freshSnapshot.roleName,
                        roleDisplayName: freshSnapshot.roleDisplayName,
                        rolesId: freshSnapshot.rolesId,
                        branchId: freshSnapshot.branchId ?? null,
                        isUse: freshSnapshot.isUse,
                        isActive: freshSnapshot.isActive,
                        lastValidatedAt: Date.now(),
                    };
                    await redis.set(sessionKey, JSON.stringify(updatedSession), { PX: SESSION_TIMEOUT });
                } else {
                    if (!session.isUse) {
                        authSessionLocalCache.delete(jti);
                        return ApiResponses.forbidden(res, "Account disabled");
                    }
                    userSnapshot = {
                        id: decoded.id,
                        username: session.username!,
                        name: session.name ?? null,
                        rolesId: session.rolesId!,
                        roleName: normalizedSessionRole!,
                        roleDisplayName: session.roleDisplayName || normalizedSessionRole!,
                        branchId: session.branchId ?? null,
                        isUse: session.isUse!,
                        isActive: session.isActive!,
                    };
                }
            } else if (isRedisConfigured()) {
                // If Redis URL is configured but client unavailable, fail closed
                return ApiResponses.internalError(res, "Session store unavailable");
            } else {
                userSnapshot = await loadAuthUserSnapshot(decoded.id);
                if (!userSnapshot) {
                    authSessionLocalCache.delete(jti);
                    return ApiResponses.unauthorized(res, "User not found");
                }
                if (!userSnapshot.isUse) {
                    authSessionLocalCache.delete(jti);
                    return ApiResponses.forbidden(res, "Account disabled");
                }
            }
        }

        if (userSnapshot) {
            writeLocalSessionSnapshot(jti, userSnapshot);
        }

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
            authSessionLocalCache.delete(jti);
            return ApiResponses.unauthorized(res, "Session expired. Please login again.");
        }

        // 3. Attach user to request
        if (!userSnapshot) {
            authSessionLocalCache.delete(jti);
            return ApiResponses.unauthorized(res, "User not found");
        }
        const user = toUsersFromSnapshot(userSnapshot);
        const normalizedRole = normalizeRoleName(userSnapshot.roleName);
        if (!normalizedRole || !user.roles) {
            authSessionLocalCache.delete(jti);
            return ApiResponses.forbidden(res, "Invalid role configuration");
        }
        user.roles.roles_name = normalizedRole;
        const isAdmin = normalizedRole === "Admin";

        // Admin branch switching:
        // - Non-admins are always scoped to their own branch_id.
        // - Admins can optionally set a selected branch via the "active_branch_id" cookie.
        //   If not set (or invalid), admin falls back to assigned branch_id.
        //   Admins without assigned branch run without branch context.
        const cookieBranchIdRaw = typeof req.cookies?.active_branch_id === "string" ? req.cookies.active_branch_id : "";
        const cookieBranchId = cookieBranchIdRaw.trim();
        const effectiveBranchId =
            isAdmin
                ? (cookieBranchId && UUID_RE.test(cookieBranchId) ? cookieBranchId : userSnapshot.branchId ?? user.branch_id)
                : (userSnapshot.branchId ?? user.branch_id);

        // Run the rest of the request inside a DB context so Postgres RLS (if enabled)
        // can enforce branch isolation even if a future query forgets branch_id filters.
        return runWithDbContext(
            { branchId: effectiveBranchId, userId: user.id, role: normalizedRole, isAdmin },
            async () => {
                req.user = user;
                req.tokenExpiry = tokenIssuedAt + SESSION_TIMEOUT;

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
        return ApiResponses.internalError(res, "Authentication system error");
    }
};
