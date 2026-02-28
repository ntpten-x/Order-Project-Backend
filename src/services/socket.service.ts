
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import { Tables } from "../entity/pos/Tables";
import { RealtimeEvents } from "../utils/realtimeEvents";
import { getRedisClient, getSessionKey, isRedisConfigured, resolveRedisConfig } from "../lib/redisClient";
import { normalizeRoleName } from "../utils/role";

const SESSION_TIMEOUT = Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000;
const AUTH_USER_DB_REVALIDATE_MS = Number(process.env.AUTH_USER_DB_REVALIDATE_MS || 5 * 60 * 1000);

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

type SocketUserSnapshot = {
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

type PublicTableSocketSnapshot = {
    id: string;
    branchId: string;
    tableName: string;
    token: string;
};

export type SocketHealthSnapshot = {
    initialized: boolean;
    connectedClients: number;
    redisAdapterEnabled: boolean;
    redisAdapterReady: boolean;
    totalConnections: number;
    authErrorCount: number;
    connectErrorCount: number;
    lastAuthErrorAt: string | null;
    lastAuthErrorMessage: string | null;
    lastConnectErrorAt: string | null;
    lastConnectErrorMessage: string | null;
    lastDisconnectReason: string | null;
};

function toBoolean(value: unknown): boolean {
    return value === true || value === "true" || value === 1 || value === "1" || value === "t";
}

function toUsersFromSnapshot(snapshot: SocketUserSnapshot): Users {
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

async function loadSocketUserSnapshot(userId: string): Promise<SocketUserSnapshot | null> {
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

async function loadPublicTableSocketSnapshot(token: string): Promise<PublicTableSocketSnapshot | null> {
    const table = await AppDataSource.getRepository(Tables)
        .createQueryBuilder("tables")
        .select("tables.id", "id")
        .addSelect("tables.branch_id", "branchId")
        .addSelect("tables.table_name", "tableName")
        .where("tables.qr_code_token = :token", { token })
        .andWhere("tables.is_active = true")
        .andWhere("(tables.qr_code_expires_at IS NULL OR tables.qr_code_expires_at > NOW())")
        .getRawOne<{
            id: string;
            branchId: string;
            tableName: string;
        }>();

    if (!table?.id || !table.branchId) {
        return null;
    }

    return {
        id: table.id,
        branchId: table.branchId,
        tableName: table.tableName,
        token,
    };
}

const parseCookies = (cookieHeader: string | undefined): { [key: string]: string } => {
    const list: { [key: string]: string } = {};
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach((cookie) => {
        let [name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });
    return list;
};

export class SocketService {
    private static instance: SocketService;
    private static readonly PUBLIC_TABLE_ROOM_PREFIX = "public-table:";
    private io: Server | null = null;
    private readonly verboseLogs = process.env.SOCKET_VERBOSE_LOG === "true";
    private adapterInitStarted = false;
    private redisAdapterReady = false;
    private totalConnections = 0;
    private authErrorCount = 0;
    private connectErrorCount = 0;
    private lastAuthErrorAt: string | null = null;
    private lastAuthErrorMessage: string | null = null;
    private lastConnectErrorAt: string | null = null;
    private lastConnectErrorMessage: string | null = null;
    private lastDisconnectReason: string | null = null;

    // Realtime event governance:
    // - "global" events are rare (system announcements only)
    // - admin events should be emitted to role room: role:Admin
    // - branch events should be emitted to branch room: branch:<branchId>
    private static readonly GLOBAL_EVENTS = new Set<string>([RealtimeEvents.system.announcement]);
    private static readonly ADMIN_EVENT_PREFIXES = ['users:', 'roles:', 'branches:'];


    private constructor() { }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public init(io: Server): void {
        this.io = io;
        void this.initRedisAdapter();

        // Middleware for authentication
        this.io.use(async (socket: Socket, next) => {
            try {
                const publicTableToken = String(socket.handshake.auth.publicTableToken || "").trim();
                if (publicTableToken) {
                    const publicTableSnapshot = await loadPublicTableSocketSnapshot(publicTableToken);
                    if (!publicTableSnapshot) {
                        const message = "Authentication error: Invalid public table token";
                        this.recordAuthError(message);
                        return next(new Error(message));
                    }

                    (socket as any).publicTable = publicTableSnapshot;
                    return next();
                }

                const cookies = parseCookies(socket.handshake.headers.cookie);
                const token = cookies['token'] || socket.handshake.auth.token; // Also check auth object

                if (process.env.NODE_ENV !== "production" || process.env.SOCKET_AUTH_DEBUG === "true") {
                    console.info("[Socket Auth Debug]", {
                        hasCookieToken: !!cookies['token'],
                        hasAuthToken: !!socket.handshake.auth.token,
                        tokenType: cookies['token'] ? "cookie" : (socket.handshake.auth.token ? "handshake.auth" : "none"),
                        cookieCount: Object.keys(cookies).length,
                        origin: socket.handshake.headers.origin,
                        domain: process.env.COOKIE_DOMAIN,
                        trustProxy: process.env.TRUST_PROXY_CHAIN
                    });
                }

                if (!token) {
                    const message = "Authentication error: No token";
                    this.recordAuthError(message);
                    return next(new Error(message));
                }

                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    const message = "Server misconfiguration: JWT_SECRET missing";
                    this.recordAuthError(message);
                    return next(new Error(message));
                }
                const decoded: any = jwt.verify(token, secret);
                const jti = decoded.jti;
                if (!decoded?.id) {
                    const message = "Authentication error: Invalid token payload";
                    this.recordAuthError(message);
                    return next(new Error(message));
                }

                let userSnapshot: SocketUserSnapshot | null = null;
                const redis = await getRedisClient();
                if (redis && jti) {
                    const sessionKey = getSessionKey(jti);
                    const sessionJson = await getSessionWithSlidingTtl(redis, sessionKey);
                    if (!sessionJson) {
                        const message = "Authentication error: Session expired";
                        this.recordAuthError(message);
                        return next(new Error(message));
                    }

                    let session: AuthSessionRecord;
                    try {
                        session = JSON.parse(sessionJson) as AuthSessionRecord;
                    } catch {
                        const message = "Authentication error: Session invalid";
                        this.recordAuthError(message);
                        return next(new Error(message));
                    }

                    if (session.userId && session.userId !== decoded.id) {
                        const message = "Authentication error: Session mismatch";
                        this.recordAuthError(message);
                        return next(new Error(message));
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
                        const freshSnapshot = await loadSocketUserSnapshot(decoded.id);
                        if (!freshSnapshot) {
                            await redis.del(sessionKey);
                            const message = "Authentication error: User not found";
                            this.recordAuthError(message);
                            return next(new Error(message));
                        }

                        if (!freshSnapshot.isUse) {
                            await redis.del(sessionKey);
                            const message = "Authentication error: Account disabled";
                            this.recordAuthError(message);
                            return next(new Error(message));
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
                            const message = "Authentication error: Account disabled";
                            this.recordAuthError(message);
                            return next(new Error(message));
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
                    const message = "Authentication error: Session store unavailable";
                    this.recordAuthError(message);
                    return next(new Error(message));
                } else {
                    userSnapshot = await loadSocketUserSnapshot(decoded.id);
                    if (!userSnapshot) {
                        const message = "Authentication error: User not found";
                        this.recordAuthError(message);
                        return next(new Error(message));
                    }
                    if (!userSnapshot.isUse) {
                        const message = "Authentication error: Account disabled";
                        this.recordAuthError(message);
                        return next(new Error(message));
                    }
                }

                if (!userSnapshot) {
                    const message = "Authentication error: User not found";
                    this.recordAuthError(message);
                    return next(new Error(message));
                }

                // Attach user to socket
                (socket as any).user = toUsersFromSnapshot(userSnapshot);
                next();
            } catch (err) {
                this.recordAuthError("Authentication error", err);
                return next(new Error("Authentication error"));
            }
        });

        this.io.on('connection', async (socket) => {
            const publicTable = (socket as any).publicTable as PublicTableSocketSnapshot | undefined;
            if (publicTable?.id) {
                this.totalConnections += 1;

                try {
                    await socket.join(this.getPublicTableRoom(publicTable.id));
                } catch (error) {
                    this.recordConnectError("Public table socket room join failed", error);
                }

                socket.on("error", (error) => {
                    this.recordConnectError("Public table socket runtime error", error);
                });

                socket.on("disconnect", (reason) => {
                    this.lastDisconnectReason = String(reason || "unknown");
                });

                if (this.verboseLogs) {
                    console.log(`Public table socket connected: ${publicTable.tableName} (${publicTable.id})`);
                }

                return;
            }

            const user = (socket as any).user as Users;
            if (!user?.id) {
                this.recordConnectError("Socket user context missing after auth");
                socket.disconnect(true);
                return;
            }
            this.totalConnections += 1;

            const userId = user.id;
            const handshakeBranchId = socket.handshake.auth.branchId;
            const branchId = handshakeBranchId || user.branch_id;
            const roleName = user.roles?.roles_name;

            // Join rooms: user-specific and branch-specific
            try {
                await socket.join(userId);
                if (branchId) {
                    await socket.join(`branch:${branchId}`);
                    if (this.verboseLogs) {
                        console.log(`User ${user.username} joined branch:${branchId}`);
                    }
                }
                if (roleName) {
                    await socket.join(`role:${roleName}`);
                }
            } catch (error) {
                this.recordConnectError("Socket room join failed", error);
            }

            // Count sockets in this room
            const sockets = await this.io?.in(userId).fetchSockets();
            const count = sockets?.length || 0;

            if (this.verboseLogs) {
                console.log(`User connected: ${user.username} (${userId}). Total connections: ${count}`);
            }

            // If this is the only connection (count is 1 because we just joined), set online
            if (count === 1) {
                await this.updateUserStatus(userId, true);
                this.emit(RealtimeEvents.users.status, { id: userId, is_active: true });
            }

            // Handle reconnection
            socket.on('reconnect', async (attemptNumber) => {
                if (this.verboseLogs) {
                    console.log(`User reconnected: ${user.username} (${userId}). Attempt: ${attemptNumber}`);
                }
                // Rejoin rooms on reconnect
                await socket.join(userId);
                if (branchId) {
                    await socket.join(`branch:${branchId}`);
                }
                if (roleName) {
                    await socket.join(`role:${roleName}`);
                }
            });

            socket.on("error", (error) => {
                this.recordConnectError("Socket runtime error", error);
            });

            socket.on('disconnect', async (reason) => {
                this.lastDisconnectReason = String(reason || "unknown");
                // Check remaining sockets in the room
                const sockets = await this.io?.in(userId).fetchSockets();
                const count = sockets?.length || 0;

                if (this.verboseLogs) {
                    console.log(`User disconnected: ${user.username} (${userId}). Reason: ${reason}. Remaining connections: ${count}`);
                }

                if (count === 0) {
                    await this.updateUserStatus(userId, false);
                    this.emit(RealtimeEvents.users.status, { id: userId, is_active: false });
                }
            });
        });
    }

    private getPublicTableRoom(tableId: string): string {
        return `${SocketService.PUBLIC_TABLE_ROOM_PREFIX}${tableId}`;
    }

    private async initRedisAdapter(): Promise<void> {
        if (!this.io || this.adapterInitStarted) return;
        this.adapterInitStarted = true;

        if (process.env.SOCKET_REDIS_ADAPTER_ENABLED !== "true") {
            return;
        }

        const resolved = resolveRedisConfig(process.env.REDIS_URL);
        if (!resolved) {
            console.warn("[SocketAdapter] SOCKET_REDIS_ADAPTER_ENABLED=true but REDIS_URL is missing.");
            return;
        }

        try {
            // Optional dependency for multi-instance Socket.IO fan-out.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const adapterPkg = require("@socket.io/redis-adapter");
            const createAdapter = adapterPkg?.createAdapter as ((pubClient: any, subClient: any) => any) | undefined;
            if (!createAdapter) {
                console.warn("[SocketAdapter] '@socket.io/redis-adapter' not available; running without distributed adapter.");
                return;
            }

            const pubClient = createClient(resolved.config);
            const subClient = pubClient.duplicate();
            pubClient.on("error", (err) => console.error("[SocketAdapter] Redis pub error:", err));
            subClient.on("error", (err) => console.error("[SocketAdapter] Redis sub error:", err));

            await Promise.all([pubClient.connect(), subClient.connect()]);
            this.io.adapter(createAdapter(pubClient, subClient));
            this.redisAdapterReady = true;
            console.info("[SocketAdapter] Redis adapter enabled for multi-instance realtime.");
        } catch (error) {
            this.redisAdapterReady = false;
            console.error("[SocketAdapter] Failed to initialize Redis adapter. Falling back to local adapter.", error);
        }
    }

    private recordAuthError(message: string, error?: unknown): void {
        this.authErrorCount += 1;
        this.lastAuthErrorAt = new Date().toISOString();
        this.lastAuthErrorMessage = this.extractErrorMessage(error) || message;
        if (error) {
            console.error("Socket auth error:", error);
        } else {
            console.warn("Socket auth error:", message);
        }
    }

    private recordConnectError(message: string, error?: unknown): void {
        this.connectErrorCount += 1;
        this.lastConnectErrorAt = new Date().toISOString();
        this.lastConnectErrorMessage = this.extractErrorMessage(error) || message;
        if (error) {
            console.error("Socket connect error:", error);
        } else {
            console.warn("Socket connect error:", message);
        }
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === "string") {
            return error;
        }
        if (error && typeof error === "object" && "message" in error) {
            const message = (error as { message?: unknown }).message;
            if (typeof message === "string") return message;
        }
        return "";
    }

    public getHealthSnapshot(): SocketHealthSnapshot {
        return {
            initialized: Boolean(this.io),
            connectedClients: this.io?.engine?.clientsCount || 0,
            redisAdapterEnabled: process.env.SOCKET_REDIS_ADAPTER_ENABLED === "true",
            redisAdapterReady: this.redisAdapterReady,
            totalConnections: this.totalConnections,
            authErrorCount: this.authErrorCount,
            connectErrorCount: this.connectErrorCount,
            lastAuthErrorAt: this.lastAuthErrorAt,
            lastAuthErrorMessage: this.lastAuthErrorMessage,
            lastConnectErrorAt: this.lastConnectErrorAt,
            lastConnectErrorMessage: this.lastConnectErrorMessage,
            lastDisconnectReason: this.lastDisconnectReason,
        };
    }

    private async updateUserStatus(userId: string, isActive: boolean) {
        try {
            const userRepository = AppDataSource.getRepository(Users);
            await userRepository.update(userId, { is_active: isActive });
            // Note: The global 'users:update' event might already be handled by the update trigger or explicit call elsewhere.
            // But adding a specific lightweight status event is good practice.
        } catch (error) {
            console.error(`Error updating status for user ${userId}:`, error);
        }
    }

    /**
     * Emit event to all connected clients
     */
    public emit(event: string, data: any): void {
        if (!this.io) {
            console.warn("Socket.IO not initialized! Event missed:", event);
            return;
        }

        // Allowlisted global events only
        if (SocketService.GLOBAL_EVENTS.has(event)) {
            this.io.emit(event, data);
            return;
        }

        // Admin-only events default to Admin room (prevents accidental global broadcast)
        if (SocketService.ADMIN_EVENT_PREFIXES.some((prefix) => event.startsWith(prefix))) {
            this.emitToRole("Admin", event, data);
            return;
        }

        // Fallback: keep backwards compatibility but warn loudly
        console.warn(`[SocketPolicy] Non-whitelisted global event emitted: ${event}. Consider emitToBranch/emitToRole.`);
        this.io.emit(event, data);
    }

    /**
     * Emit event to a specific user
     */
    public emitToUser(userId: string, event: string, data: any): void {
        if (this.io) {
            this.io.to(userId).emit(event, data);
        } else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }

    /**
     * Emit event to all users in a specific branch (room-based broadcasting)
     */
    public emitToBranch(branchId: string, event: string, data: any): void {
        if (this.io) {
            this.io.to(`branch:${branchId}`).emit(event, data);
        } else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }

    /**
     * Emit event to all users with a specific role (role room-based broadcasting)
     */
    public emitToRole(roleName: string, event: string, data: any): void {
        if (this.io) {
            this.io.to(`role:${roleName}`).emit(event, data);
        } else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }

    /**
     * Emit event to multiple users
     */
    public emitToUsers(userIds: string[], event: string, data: any): void {
        if (this.io) {
            userIds.forEach(userId => {
                this.io!.to(userId).emit(event, data);
            });
        } else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }

    /**
     * Emit event to public clients viewing a specific table QR order page.
     */
    public emitToPublicTable(tableId: string, event: string, data: any): void {
        if (this.io) {
            this.io.to(this.getPublicTableRoom(tableId)).emit(event, data);
        } else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }
}
