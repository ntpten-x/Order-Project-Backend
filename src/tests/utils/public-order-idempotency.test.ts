import { describe, expect, it, beforeEach } from "vitest";
import {
    clearPublicOrderIdempotency,
    commitPublicOrderIdempotency,
    reservePublicOrderIdempotency,
    resetPublicOrderIdempotencyMemoryStoreForTests,
} from "../../utils/publicOrderIdempotency";

describe("public order idempotency utility", () => {
    beforeEach(() => {
        resetPublicOrderIdempotencyMemoryStoreForTests();
    });

    it("returns disabled when idempotency header is not provided", async () => {
        const result = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            payload: { items: [{ product_id: "a", quantity: 1 }] },
        });

        expect(result).toEqual({ status: "disabled" });
    });

    it("replays committed response for the same key and same payload", async () => {
        const first = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            idempotencyKeyHeader: "demo-key-1",
            payload: { items: [{ product_id: "a", quantity: 1 }] },
        });

        expect(first.status).toBe("acquired");
        if (first.status !== "acquired") {
            throw new Error("Expected acquired reservation");
        }

        await commitPublicOrderIdempotency(first.reservation, {
            statusCode: 200,
            body: { success: true, data: { mode: "create" } },
        });

        const replay = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            idempotencyKeyHeader: "demo-key-1",
            payload: { items: [{ product_id: "a", quantity: 1 }] },
        });

        expect(replay.status).toBe("replay");
        if (replay.status === "replay") {
            expect(replay.response.statusCode).toBe(200);
            expect(replay.response.body).toEqual({ success: true, data: { mode: "create" } });
        }
    });

    it("returns conflict when same key is reused with a different payload", async () => {
        const first = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            idempotencyKeyHeader: "demo-key-2",
            payload: { items: [{ product_id: "a", quantity: 1 }] },
        });

        expect(first.status).toBe("acquired");

        const second = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            idempotencyKeyHeader: "demo-key-2",
            payload: { items: [{ product_id: "a", quantity: 2 }] },
        });

        expect(second.status).toBe("conflict");

        if (first.status === "acquired") {
            await clearPublicOrderIdempotency(first.reservation);
        }
    });

    it("returns in_progress while a key is still processing", async () => {
        const first = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            idempotencyKeyHeader: "demo-key-3",
            payload: { items: [{ product_id: "a", quantity: 1 }] },
        });
        expect(first.status).toBe("acquired");

        const second = await reservePublicOrderIdempotency({
            token: "token-1234567890",
            idempotencyKeyHeader: "demo-key-3",
            payload: { items: [{ product_id: "a", quantity: 1 }] },
        });

        expect(second.status).toBe("in_progress");

        if (first.status === "acquired") {
            await clearPublicOrderIdempotency(first.reservation);
        }
    });
});
