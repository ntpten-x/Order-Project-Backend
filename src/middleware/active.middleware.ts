import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";
import { ApiResponses } from "../utils/ApiResponse";

export const checkActiveObj = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
        return ApiResponses.unauthorized(res, "Authentication required");
    }

    if (req.user.is_use === false) {
        return ApiResponses.forbidden(res, "Account disabled. Please contact administrator.");
    }

    next();
};
