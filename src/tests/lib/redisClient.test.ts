import { describe, expect, it } from "vitest";
import { resolveRedisConnectionUrlFromEnv } from "../../lib/redisClient";

describe("redis client env url resolver", () => {
    it("uses explicit url when provided", () => {
        const url = resolveRedisConnectionUrlFromEnv({
            url: "redis://cache:6380/1",
            host: "ignored-host",
            port: "1234",
        });

        expect(url).toBe("redis://cache:6380/1");
    });

    it("builds redis url from host/port credentials and db", () => {
        const url = resolveRedisConnectionUrlFromEnv({
            host: "127.0.0.1",
            port: "6380",
            username: "app",
            password: "secret",
            database: "2",
        });

        expect(url).toBe("redis://app:secret@127.0.0.1:6380/2");
    });

    it("falls back to default port when port is invalid", () => {
        const url = resolveRedisConnectionUrlFromEnv({
            host: "redis",
            port: "invalid",
        });

        expect(url).toBe("redis://redis:6379");
    });

    it("returns undefined when host and url are missing", () => {
        const url = resolveRedisConnectionUrlFromEnv({
            host: "",
            url: "",
        });

        expect(url).toBeUndefined();
    });
});
