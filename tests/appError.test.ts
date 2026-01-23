import { describe, it, expect } from "vitest";
import { AppError } from "../src/utils/AppError";

describe("AppError", () => {
    it("sets status fail for 4xx", () => {
        const err = new AppError("bad", 404);
        expect(err.status).toBe("fail");
        expect(err.isOperational).toBe(true);
    });

    it("sets status error for 5xx", () => {
        const err = new AppError("boom", 500);
        expect(err.status).toBe("error");
    });
});
