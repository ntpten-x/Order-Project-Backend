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
                return res.status(401).json({ message: "Invalid username or password" });
            }

            // Check if user is disabled
            if (user.is_use === false) {
                return res.status(403).json({ message: "Account disabled." });
            }

            // Compare password
            // Note: In a real app, passwords should be hashed. 
            // If the DB currently has plain text passwords, this might fail if we assume hash.
            // I'll assume they are hashed with bcrypt. If not, I'll check directly or we need to hash them.
            // For safety, I'll try bcrypt.compare, invalid if not hashed.
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.status(401).json({ message: "Invalid username or password" });
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
                sameSite: "strict", // Protects against CSRF
                maxAge: 36000000 // 10 hours in ms
            });

            // Update last_login_at
            user.last_login_at = new Date();
            await userRepository.save(user);

            return res.status(200).json({
                message: "Login successful",
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.roles.roles_name,
                    display_name: user.roles.display_name
                }
            });

        } catch (error) {
            console.error("Login error:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    static async logout(req: Request, res: Response) {
        res.clearCookie("token");
        return res.status(200).json({ message: "Logout successful" });
    }

    static async getMe(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const { password, ...userWithoutPassword } = req.user;
        return res.json(userWithoutPassword);
    }
}
