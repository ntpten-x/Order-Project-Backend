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
exports.SocketService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../database/database");
const Users_1 = require("../entity/Users");
// Since 'cookie-parser' is installed, 'cookie' is likely available or I can use basic parsing. 
// I'll try to import 'cookie'. If it fails, I'll use a simple regex or require 'cookie'.
// Actually 'cookie-parser' uses 'cookie'. I'll assume 'cookie' is hoistable or just use a helper.
// Better to check if I can import it. I'll rely on 'cookie' package or write a parser helper.
// For now, I'll write a simple parser to avoid dependency issues if 'cookie' isn't explicitly top-level.
const parseCookies = (cookieHeader) => {
    const list = {};
    if (!cookieHeader)
        return list;
    cookieHeader.split(`;`).forEach((cookie) => {
        let [name, ...rest] = cookie.split(`=`);
        name = name === null || name === void 0 ? void 0 : name.trim();
        if (!name)
            return;
        const value = rest.join(`=`).trim();
        if (!value)
            return;
        list[name] = decodeURIComponent(value);
    });
    return list;
};
class SocketService {
    constructor() {
        this.io = null;
        // Map to track number of active connections per user: userId -> count
        this.activeConnections = new Map();
    }
    static getInstance() {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }
    init(io) {
        this.io = io;
        // Middleware for authentication
        this.io.use((socket, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const cookies = parseCookies(socket.handshake.headers.cookie);
                const token = cookies['token'] || socket.handshake.auth.token; // Also check auth object
                if (!token) {
                    return next(new Error("Authentication error: No token"));
                }
                const secret = process.env.JWT_SECRET || "default_secret_key";
                const decoded = jsonwebtoken_1.default.verify(token, secret);
                // Fetch user to check is_use
                const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
                const user = yield userRepository.findOneBy({ id: decoded.id });
                if (!user) {
                    return next(new Error("Authentication error: User not found"));
                }
                if (!user.is_use) {
                    return next(new Error("Authentication error: Account disabled"));
                }
                // Attach user to socket
                socket.user = user;
                next();
            }
            catch (err) {
                console.error("Socket auth error:", err);
                return next(new Error("Authentication error"));
            }
        }));
        this.io.on('connection', (socket) => __awaiter(this, void 0, void 0, function* () {
            const user = socket.user;
            const userId = user.id;
            // Increment connection count
            const currentCount = this.activeConnections.get(userId) || 0;
            this.activeConnections.set(userId, currentCount + 1);
            console.log(`User connected: ${user.username} (${userId}). Total connections: ${currentCount + 1}`);
            // If this is the first connection, set is_active = true
            if (currentCount === 0) {
                yield this.updateUserStatus(userId, true);
                // Emit status update to all clients immediately
                this.emit('users:update-status', { id: userId, is_active: true });
            }
            socket.on('disconnect', () => __awaiter(this, void 0, void 0, function* () {
                const userCount = this.activeConnections.get(userId) || 0;
                if (userCount > 1) {
                    // Decrement if more than 1
                    this.activeConnections.set(userId, userCount - 1);
                    console.log(`User disconnected: ${user.username} (${userId}). Remaining connections: ${userCount - 1}`);
                }
                else {
                    // Last connection closed, remove from map and set is_active = false
                    this.activeConnections.delete(userId);
                    console.log(`User disconnected: ${user.username} (${userId}). No remaining connections. Setting offline.`);
                    yield this.updateUserStatus(userId, false);
                    // Emit status update to all clients
                    this.emit('users:update-status', { id: userId, is_active: false });
                }
            }));
        }));
    }
    updateUserStatus(userId, isActive) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userRepository = database_1.AppDataSource.getRepository(Users_1.Users);
                yield userRepository.update(userId, { is_active: isActive });
                // Note: The global 'users:update' event might already be handled by the update trigger or explicit call elsewhere.
                // But adding a specific lightweight status event is good practice.
            }
            catch (error) {
                console.error(`Error updating status for user ${userId}:`, error);
            }
        });
    }
    emit(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
        else {
            console.warn("Socket.IO not initialized! Event missed:", event);
        }
    }
}
exports.SocketService = SocketService;
