import { describe, it, expect, vi } from "vitest";
import { validate } from "../src/middleware/validate.middleware";
import { loginSchema } from "../src/utils/schemas/auth.schema";

const mockRes = () => {
    const res: any = {};
    res.statusCode = 200;
    res.status = vi.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.json = vi.fn().mockImplementation((body: any) => {
        res.body = body;
        return res;
    });
    return res;
};

describe("validate middleware", () => {
    it("passes on valid payload", () => {
        const req: any = { body: { username: "user", password: "pass" }, query: {}, params: {} };
        const res = mockRes();
        const next = vi.fn();
        validate(loginSchema)(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it("returns 400 on invalid payload", () => {
        const req: any = { body: { username: "", password: "" }, query: {}, params: {} };
        const res = mockRes();
        const next = vi.fn();
        validate(loginSchema)(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });
});
