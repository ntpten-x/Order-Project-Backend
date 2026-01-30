"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const validate_middleware_1 = require("../src/middleware/validate.middleware");
const auth_schema_1 = require("../src/utils/schemas/auth.schema");
const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = vitest_1.vi.fn().mockImplementation((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = vitest_1.vi.fn().mockImplementation((body) => {
        res.body = body;
        return res;
    });
    return res;
};
(0, vitest_1.describe)("validate middleware", () => {
    (0, vitest_1.it)("passes on valid payload", () => {
        const req = { body: { username: "user", password: "pass" }, query: {}, params: {} };
        const res = mockRes();
        const next = vitest_1.vi.fn();
        (0, validate_middleware_1.validate)(auth_schema_1.loginSchema)(req, res, next);
        (0, vitest_1.expect)(next).toHaveBeenCalledOnce();
    });
    (0, vitest_1.it)("returns 400 on invalid payload", () => {
        const req = { body: { username: "", password: "" }, query: {}, params: {} };
        const res = mockRes();
        const next = vitest_1.vi.fn();
        (0, validate_middleware_1.validate)(auth_schema_1.loginSchema)(req, res, next);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(400);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
});
