import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";

export interface AuthRequest extends Request {
    user?: Users;
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
        // Allow public access or just fail? Usually middleware blocks.
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ message: "Server misconfiguration: JWT_SECRET missing" });
        }
        const decoded: any = jwt.verify(token, secret);

        // 3. Attach user to request (including branch relation for branch-based filtering)
        const userRepository = AppDataSource.getRepository(Users);
        const user = await userRepository.findOne({
            where: { id: decoded.id },
            relations: ["roles", "branch"]
        });

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        if (!user.is_use) {
            return res.status(403).json({ message: "Account disabled" });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
            return res.status(403).json({ message: "Invalid or expired token" });
        }
        console.error("Authentication Error (System):", err);
        return res.status(500).json({ message: "Authentication system error", error: (err as any).message });
    }
};

export const authorizeRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const userRole = req.user.roles?.roles_name;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: "Access denied: Insufficient permissions" });
        }

        next();
    };
};
