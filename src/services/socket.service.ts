
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import cookie from "cookie"; // You might need to install 'cookie' and '@types/cookie' if not present, checking dependencies.
// Since 'cookie-parser' is installed, 'cookie' is likely available or I can use basic parsing. 
// I'll try to import 'cookie'. If it fails, I'll use a simple regex or require 'cookie'.

// Actually 'cookie-parser' uses 'cookie'. I'll assume 'cookie' is hoistable or just use a helper.
// Better to check if I can import it. I'll rely on 'cookie' package or write a parser helper.
// For now, I'll write a simple parser to avoid dependency issues if 'cookie' isn't explicitly top-level.
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


    private constructor() { }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public init(io: Server): void {
        this.io = io;

        // Middleware for authentication
        this.io.use(async (socket: Socket, next) => {
            try {
                const cookies = parseCookies(socket.handshake.headers.cookie);
                const token = cookies['token'] || socket.handshake.auth.token; // Also check auth object

                if (!token) {
                    return next(new Error("Authentication error: No token"));
                }

                const secret = process.env.JWT_SECRET || "default_secret_key";
                const decoded: any = jwt.verify(token, secret);

                // Fetch user to check is_use
                const userRepository = AppDataSource.getRepository(Users);
                const user = await userRepository.findOneBy({ id: decoded.id });

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

            // Join a room with the user's ID
            await socket.join(userId);

            // Count sockets in this room
            const sockets = await this.io?.in(userId).fetchSockets();
            const count = sockets?.length || 0;

            console.log(`User connected: ${user.username} (${userId}). Total connections: ${count}`);

            // If this is the only connection (count is 1 because we just joined), set online
            if (count === 1) {
                await this.updateUserStatus(userId, true);
                this.emit('users:update-status', { id: userId, is_active: true });
            }

            socket.on('disconnect', async () => {
                // Check remaining sockets in the room
                const sockets = await this.io?.in(userId).fetchSockets();
                const count = sockets?.length || 0;

                console.log(`User disconnected: ${user.username} (${userId}). Remaining connections: ${count}`);

                if (count === 0) {
                    await this.updateUserStatus(userId, false);
                    this.emit('users:update-status', { id: userId, is_active: false });
                }
            });
        });
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

    public emit(event: string, data: any): void {
        if (this.io) {
            this.io.emit(event, data);
        } else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }
}
