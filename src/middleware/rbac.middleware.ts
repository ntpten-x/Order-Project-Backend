import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";

export const checkRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !req.user.roles) {
            return ApiResponses.forbidden(res, "Access denied: No role assigned");
        }

        const userRole = req.user.roles.roles_name;

        if (allowedRoles.includes(userRole)) {
            next();
        } else {
            return ApiResponses.forbidden(res, "Access denied: Insufficient permissions");
        }
    };
};
