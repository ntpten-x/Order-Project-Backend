import { describe, expect, it } from "vitest";
import { sanitizeObject, sanitizeString } from "../../utils/sanitize";

describe("sanitize utilities", () => {
    it("sanitizes normal text input", () => {
        const input = `<img src="x" onclick=alert(1)> javascript:alert(1)`;
        const output = sanitizeString(input);

        expect(output).not.toContain("<");
        expect(output).not.toContain(">");
        expect(output.toLowerCase()).not.toContain("javascript:");
        expect(output.toLowerCase()).not.toContain("onclick=");
    });

    it("preserves long data:image payloads", () => {
        const payload = "QUJD".repeat(3500); // > 10k chars
        const dataUrl = `data:image/png;base64,${payload}`;

        const output = sanitizeString(dataUrl);
        expect(output).toBe(dataUrl);
        expect(output.length).toBeGreaterThan(10000);
    });

    it("keeps nested data:image fields intact in objects", () => {
        const payload = "QUJD".repeat(2000);
        const body = {
            logo: `data:image/png;base64,${payload}`,
            note: `<b onclick=alert(1)>test</b>`,
        };

        const output = sanitizeObject(body);
        expect(output.logo).toBe(body.logo);
        expect(output.note).toBe("b alert(1)test/b");
    });
});

