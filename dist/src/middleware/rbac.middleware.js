"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRole = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: No role assigned");
        }
        const userRole = req.user.roles.roles_name;
        if (allowedRoles.includes(userRole)) {
            next();
        }
        else {
            return ApiResponse_1.ApiResponses.forbidden(res, "Access denied: Insufficient permissions");
        }
    };
};
exports.checkRole = checkRole;
