"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRoleName = normalizeRoleName;
function normalizeToken(value) {
    return String(value !== null && value !== void 0 ? value : "").trim().toLowerCase();
}
function normalizeRoleName(value) {
    const raw = normalizeToken(value);
    if (!raw)
        return null;
    if (raw === "admin")
        return "Admin";
    if (raw === "manager")
        return "Manager";
    if (raw === "employee")
        return "Employee";
    return null;
}
