import { describe, expect, it } from "vitest";
import { parseStatusQuery } from "../../utils/statusQuery";

describe("parseStatusQuery", () => {
    it("returns undefined when query is empty", () => {
        expect(parseStatusQuery(undefined)).toBeUndefined();
        expect(parseStatusQuery("")).toBeUndefined();
        expect(parseStatusQuery(" , , ")).toBeUndefined();
    });

    it("trims and removes empty statuses", () => {
        expect(parseStatusQuery("Paid, Completed,, Cancelled  ")).toEqual([
            "Paid",
            "Completed",
            "Cancelled",
        ]);
    });
});

