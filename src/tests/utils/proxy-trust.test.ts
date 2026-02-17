import { afterEach, describe, expect, it } from "vitest";
import { isTrustedProxyChainConfigured, resolveRequestIsSecure } from "../../utils/proxyTrust";

type MockReq = {
    secure: boolean;
    headers: Record<string, string | string[] | undefined>;
};

const originalTrustProxyChain = process.env.TRUST_PROXY_CHAIN;

afterEach(() => {
    if (originalTrustProxyChain === undefined) {
        delete process.env.TRUST_PROXY_CHAIN;
    } else {
        process.env.TRUST_PROXY_CHAIN = originalTrustProxyChain;
    }
});

function makeReq(secure: boolean, forwardedProto?: string): MockReq {
    return {
        secure,
        headers: {
            "x-forwarded-proto": forwardedProto,
        },
    };
}

describe("proxy trust utilities", () => {
    it("does not trust forwarded proto when trusted proxy chain is not configured", () => {
        delete process.env.TRUST_PROXY_CHAIN;
        const req = makeReq(false, "https");

        expect(isTrustedProxyChainConfigured()).toBe(false);
        expect(resolveRequestIsSecure(req as any)).toBe(false);
    });

    it("uses req.secure regardless of proxy-chain config", () => {
        delete process.env.TRUST_PROXY_CHAIN;
        const req = makeReq(true, "http");

        expect(resolveRequestIsSecure(req as any)).toBe(true);
    });

    it("trusts sanitized first hop proto when proxy chain is configured", () => {
        process.env.TRUST_PROXY_CHAIN = "1";
        const req = makeReq(false, "https, http");

        expect(isTrustedProxyChainConfigured()).toBe(true);
        expect(resolveRequestIsSecure(req as any)).toBe(true);
    });

    it("rejects non-https forwarded proto even when proxy chain is configured", () => {
        process.env.TRUST_PROXY_CHAIN = "10.0.0.0/8,127.0.0.1";
        const req = makeReq(false, "http");

        expect(resolveRequestIsSecure(req as any)).toBe(false);
    });
});
