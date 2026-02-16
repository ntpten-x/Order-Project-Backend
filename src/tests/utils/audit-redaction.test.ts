import { describe, it, expect } from "vitest";
import { redactAuditPayload } from "../../utils/auditRedaction";

describe("auditRedaction", () => {
    it("redacts sensitive keys recursively", () => {
        const input = {
            username: "alice",
            password: "supersecret",
            profile: {
                access_token: "abc",
                nested: {
                    apiKey: "k",
                },
            },
        };

        const out = redactAuditPayload(input) as any;
        expect(out.username).toBe("alice");
        expect(out.password).toBe("[REDACTED]");
        expect(out.profile.access_token).toBe("[REDACTED]");
        expect(out.profile.nested.apiKey).toBe("[REDACTED]");
    });

    it("truncates long strings", () => {
        const long = "x".repeat(5000);
        const out = redactAuditPayload({ description: long }, { maxStringLength: 100 }) as any;
        expect(out.description.length).toBeGreaterThanOrEqual(100);
        expect(out.description).toContain("[TRUNCATED]");
    });

    it("handles circular references safely", () => {
        const a: any = { ok: true };
        a.self = a;

        const out = redactAuditPayload(a) as any;
        expect(out.ok).toBe(true);
        expect(out.self).toBe("[CIRCULAR]");
    });
});

