import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../database/database";
import { Users } from "../entity/Users";

export interface AuthRequest extends Request {
    user?: Users;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // 1. Get token from cookies
    const token = req.cookies?.token;

    if (!token) {
        // Allow public access or just fail? Usually middleware blocks.
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET || "default_secret_key";
        const decoded: any = jwt.verify(token, secret);

        // 3. Attach user to request
        const userRepository = AppDataSource.getRepository(Users);
        const user = await userRepository.findOne({
            where: { id: decoded.id },
            relations: ["roles"]
        });

        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};
