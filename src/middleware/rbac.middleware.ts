import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const checkRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({ message: "Access denied: No role assigned" });
        }

        const userRole = req.user.roles.roles_name;

        if (allowedRoles.includes(userRole)) {
            next();
        } else {
            return res.status(403).json({ message: "Access denied: Insufficient permissions" });
        }
    };
};
