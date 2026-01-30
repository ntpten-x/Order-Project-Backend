"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const AppError_1 = require("../src/utils/AppError");
(0, vitest_1.describe)("AppError", () => {
    (0, vitest_1.it)("sets status fail for 4xx", () => {
        const err = new AppError_1.AppError("bad", 404);
        (0, vitest_1.expect)(err.status).toBe("fail");
        (0, vitest_1.expect)(err.isOperational).toBe(true);
    });
    (0, vitest_1.it)("sets status error for 5xx", () => {
        const err = new AppError_1.AppError("boom", 500);
        (0, vitest_1.expect)(err.status).toBe("error");
    });
});
