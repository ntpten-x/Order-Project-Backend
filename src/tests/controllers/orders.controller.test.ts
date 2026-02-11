import { describe, expect, it } from "vitest";
import { parseStatusQuery } from "../../utils/statusQuery";

describe("OrdersController status parsing", () => {
    it("parses and trims statuses from query string", () => {
        expect(parseStatusQuery("Paid, Completed,Cancelled")).toEqual([
            "Paid",
            "Completed",
            "Cancelled",
        ]);
    });

    it("removes empty values from query string", () => {
        expect(parseStatusQuery("Paid, , ,Cancelled")).toEqual(["Paid", "Cancelled"]);
    });
});
