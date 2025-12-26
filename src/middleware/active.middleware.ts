import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const checkActiveObj = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.is_use === false) {
        return res.status(403).json({ message: "Account disabled. Please contact administrator." });
    }

    next();
};
