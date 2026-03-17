import { describe, expect, it } from "vitest";
import { sanitizeAuditLogForResponse, sanitizeAuditSnapshot } from "../../utils/auditSanitizer";

describe("audit sanitizer", () => {
    it("redacts nested secrets and masks account numbers", () => {
        const sanitized = sanitizeAuditSnapshot({
            password: "hash",
            nested: {
                token: "abc123",
                account_number: "1234567890",
            },
            list: [
                { qr_code_token: "secret-token" },
                { safe: "value" },
            ],
        });

        expect(sanitized).toEqual({
            password: "[REDACTED]",
            nested: {
                token: "[REDACTED]",
                account_number: "******7890",
            },
            list: [
                { qr_code_token: "[REDACTED]" },
                { safe: "value" },
            ],
        });
    });

    it("sanitizes audit log payloads without changing metadata", () => {
        const log = sanitizeAuditLogForResponse({
            id: "log-1",
            action_type: "TABLE_UPDATE" as any,
            ip_address: "127.0.0.1",
            created_at: new Date("2026-03-17T00:00:00Z"),
            old_values: { qr_code_token: "secret" },
            new_values: { account_number: "9999888877776666" },
        } as any);

        expect(log.id).toBe("log-1");
        expect(log.old_values).toEqual({ qr_code_token: "[REDACTED]" });
        expect(log.new_values).toEqual({ account_number: "************6666" });
    });
});
