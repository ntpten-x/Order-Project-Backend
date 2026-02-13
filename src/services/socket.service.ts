
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { createClient } from "redis";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import { RealtimeEvents } from "../utils/realtimeEvents";
import { getRedisClient, getSessionKey, isRedisConfigured, resolveRedisConfig } from "../lib/redisClient";
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
    private io: Server | null = null;
    private adapterInitStarted = false;

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
                const cookies = parseCookies(socket.handshake.headers.cookie);
                const token = cookies['token'] || socket.handshake.auth.token; // Also check auth object

                if (!token) {
                    return next(new Error("Authentication error: No token"));
                }

                const secret = process.env.JWT_SECRET;
                if (!secret) {
                    return next(new Error("Server misconfiguration: JWT_SECRET missing"));
                }
                const decoded: any = jwt.verify(token, secret);
                const jti = decoded.jti;

                const redis = await getRedisClient();
                if (redis && jti) {
                    const sessionKey = getSessionKey(jti);
                    const session = await redis.get(sessionKey);
                    if (!session) {
                        return next(new Error("Authentication error: Session expired"));
                    }
                    await redis.pExpire(sessionKey, Number(process.env.SESSION_TIMEOUT_MS) || 8 * 60 * 60 * 1000);
                } else if (isRedisConfigured()) {
                    return next(new Error("Authentication error: Session store unavailable"));
                }

                // Fetch user to check is_use
                const userRepository = AppDataSource.getRepository(Users);
                const user = await userRepository.findOne({
                    where: { id: decoded.id },
                    relations: ["roles"],
                });

                if (!user) {
                    return next(new Error("Authentication error: User not found"));
                }

                if (!user.is_use) {
                    return next(new Error("Authentication error: Account disabled"));
                }

                // Attach user to socket
                (socket as any).user = user;
                next();
            } catch (err) {
                console.error("Socket auth error:", err);
                return next(new Error("Authentication error"));
            }
        });

        this.io.on('connection', async (socket) => {
            const user = (socket as any).user as Users;
            const userId = user.id;
            const branchId = user.branch_id;
            const roleName = user.roles?.roles_name;

            // Join rooms: user-specific and branch-specific
            await socket.join(userId);
            if (branchId) {
                await socket.join(`branch:${branchId}`);
            }
            if (roleName) {
                await socket.join(`role:${roleName}`);
            }

            // Count sockets in this room
            const sockets = await this.io?.in(userId).fetchSockets();
            const count = sockets?.length || 0;

            console.log(`User connected: ${user.username} (${userId}). Total connections: ${count}`);

            // If this is the only connection (count is 1 because we just joined), set online
            if (count === 1) {
                await this.updateUserStatus(userId, true);
                this.emit(RealtimeEvents.users.status, { id: userId, is_active: true });
            }

            // Handle reconnection
            socket.on('reconnect', async (attemptNumber) => {
                console.log(`User reconnected: ${user.username} (${userId}). Attempt: ${attemptNumber}`);
                // Rejoin rooms on reconnect
                await socket.join(userId);
                if (branchId) {
                    await socket.join(`branch:${branchId}`);
                }
                if (roleName) {
                    await socket.join(`role:${roleName}`);
                }
            });

            socket.on('disconnect', async (reason) => {
                // Check remaining sockets in the room
                const sockets = await this.io?.in(userId).fetchSockets();
                const count = sockets?.length || 0;

                console.log(`User disconnected: ${user.username} (${userId}). Reason: ${reason}. Remaining connections: ${count}`);

                if (count === 0) {
                    await this.updateUserStatus(userId, false);
                    this.emit(RealtimeEvents.users.status, { id: userId, is_active: false });
                }
            });
        });
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
            console.info("[SocketAdapter] Redis adapter enabled for multi-instance realtime.");
        } catch (error) {
            console.error("[SocketAdapter] Failed to initialize Redis adapter. Falling back to local adapter.", error);
        }
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
}
