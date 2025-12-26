"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRole = void 0;
const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({ message: "Access denied: No role assigned" });
        }
        const userRole = req.user.roles.roles_name;
        if (allowedRoles.includes(userRole)) {
            next();
        }
        else {
            return res.status(403).json({ message: "Access denied: Insufficient permissions" });
        }
    };
};
exports.checkRole = checkRole;
