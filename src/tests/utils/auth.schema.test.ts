import { describe, expect, it } from "vitest";
import { updateMeSchema } from "../../utils/schemas/auth.schema";

describe("auth schema - updateMeSchema", () => {
    it("accepts a trimmed non-empty name", () => {
        const parsed = updateMeSchema.safeParse({
            body: {
                name: "  Alice  ",
            },
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.body.name).toBe("Alice");
        }
    });

    it("rejects whitespace-only name", () => {
        const parsed = updateMeSchema.safeParse({
            body: {
                name: "   ",
            },
        });

        expect(parsed.success).toBe(false);
    });

    it("requires at least one field", () => {
        const parsed = updateMeSchema.safeParse({ body: {} });
        expect(parsed.success).toBe(false);
    });
});
