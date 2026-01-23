import { describe, it, expect, vi } from "vitest";
import { catchAsync } from "../src/utils/catchAsync";

describe("catchAsync", () => {
    it("forwards rejected promise to next", async () => {
        const error = new Error("boom");
        const fn = catchAsync(async () => {
            throw error;
        });

        const next = vi.fn();
        fn({} as any, {} as any, next);
        await Promise.resolve(); // allow promise to settle
        expect(next).toHaveBeenCalledWith(error);
    });
});
