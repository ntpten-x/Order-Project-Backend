import { Request, Response } from "express";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/auth.middleware";

export class AuthController {

    static async login(req: Request, res: Response) {
        const { username, password } = req.body;
        const userRepository = AppDataSource.getRepository(Users);

        try {
            const user = await userRepository.findOne({
                where: { username },
                relations: ["roles"]
            });

            if (!user) {
                return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
            }

            // Check if user is disabled
            if (user.is_use === false) {
                return res.status(403).json({ message: "บัญชีถูกปิด" });
            }

            // Compare password
            // Note: In a real app, passwords should be hashed. 
            // If the DB currently has plain text passwords, this might fail if we assume hash.
            // I'll assume they are hashed with bcrypt. If not, I'll check directly or we need to hash them.
            // For safety, I'll try bcrypt.compare, invalid if not hashed.
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ message: "ไม่พบข้อมูลผู้ใช้" });
            }

            // Generate Token
            const secret = process.env.JWT_SECRET || "default_secret_key";
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

            return res.status(200).json({
                message: "เข้าสู่ระบบสำเร็จ",
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.roles.roles_name,
                    display_name: user.roles.display_name
                }
            });

        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการเข้าสู่ระบบ:", error);
            return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
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
        return res.status(200).json({ message: "ออกจากระบบสำเร็จ" });
    }

    static async getMe(req: AuthRequest, res: Response) {
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
            is_use: user.is_use
        });
    }
}
