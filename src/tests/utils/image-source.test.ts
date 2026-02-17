import { describe, expect, it } from "vitest";
import { isSupportedImageSource, normalizeImageSource, normalizeImageSourceInput } from "../../utils/imageSource";

describe("imageSource utility", () => {
    it("normalizes data:image URLs with extra whitespace", () => {
        const raw = "data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUA";
        const normalized = normalizeImageSource(raw);

        expect(normalized).toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA");
        expect(isSupportedImageSource(normalized)).toBe(true);
    });

    it("supports raw base64 payload by converting to data URL", () => {
        const rawBase64 = "QUJD".repeat(32);
        const normalized = normalizeImageSourceInput(rawBase64);

        expect(normalized?.startsWith("data:image/png;base64,")).toBe(true);
        expect(isSupportedImageSource(normalized)).toBe(true);
    });
});

