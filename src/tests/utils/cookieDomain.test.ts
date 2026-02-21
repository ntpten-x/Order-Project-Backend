import { afterEach, describe, expect, it } from "vitest";
import { resolveConfiguredCookieDomain, resolveCookieDomainForRequest } from "../../utils/cookieDomain";

const originalCookieDomain = process.env.COOKIE_DOMAIN;

afterEach(() => {
    if (originalCookieDomain === undefined) {
        delete process.env.COOKIE_DOMAIN;
    } else {
        process.env.COOKIE_DOMAIN = originalCookieDomain;
    }
});

describe("cookie domain resolver", () => {
    it("returns undefined when COOKIE_DOMAIN is empty", () => {
        delete process.env.COOKIE_DOMAIN;
        expect(resolveConfiguredCookieDomain()).toBeUndefined();
    });

    it("sanitizes configured domain and strips leading dot", () => {
        process.env.COOKIE_DOMAIN = ".pos-hub.shop";
        expect(resolveConfiguredCookieDomain()).toBe("pos-hub.shop");
    });

    it("accepts request host under configured domain", () => {
        process.env.COOKIE_DOMAIN = "https://pos-hub.shop";
        const result = resolveCookieDomainForRequest({
            hostname: "system.pos-hub.shop",
            headers: {},
        } as any);
        expect(result).toBe("pos-hub.shop");
    });

    it("prefers forwarded host when backend host is internal", () => {
        process.env.COOKIE_DOMAIN = "pos-hub.shop";
        const result = resolveCookieDomainForRequest({
            hostname: "backend",
            headers: { "x-forwarded-host": "system.pos-hub.shop" },
        } as any);
        expect(result).toBe("pos-hub.shop");
    });

    it("rejects domain override for non-matching request host", () => {
        process.env.COOKIE_DOMAIN = "pos-hub.shop";
        const result = resolveCookieDomainForRequest({
            hostname: "18.143.76.86",
            headers: {},
        } as any);
        expect(result).toBeUndefined();
    });

    it("rejects invalid local domains", () => {
        process.env.COOKIE_DOMAIN = "localhost";
        expect(resolveConfiguredCookieDomain()).toBeUndefined();
    });
});
