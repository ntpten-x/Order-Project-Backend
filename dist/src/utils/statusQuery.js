"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStatusQuery = void 0;
const parseStatusQuery = (raw) => {
    if (!raw)
        return undefined;
    const statuses = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return statuses.length > 0 ? statuses : undefined;
};
exports.parseStatusQuery = parseStatusQuery;
