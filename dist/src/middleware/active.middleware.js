"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkActiveObj = void 0;
const checkActiveObj = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user.is_use === false) {
        return res.status(403).json({ message: "Account disabled. Please contact administrator." });
    }
    next();
};
exports.checkActiveObj = checkActiveObj;
