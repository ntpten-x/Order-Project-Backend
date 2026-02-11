import { describe, expect, it } from "vitest";
import { filterSuccessfulPayments, sumPaymentAmount } from "../../services/pos/shiftSummary.utils";

describe("ShiftsService payment aggregation", () => {
    it("includes only Success payments", () => {
        const rows = filterSuccessfulPayments([
            { status: "Success", amount: 100 },
            { status: "Failed", amount: 999 },
            { status: "Pending", amount: 555 },
        ]);
        expect(rows).toEqual([{ status: "Success", amount: 100 }]);
    });

    it("sums payment amounts safely", () => {
        expect(sumPaymentAmount([{ amount: 10 }, { amount: "20.25" }, { amount: undefined }])).toBe(30.25);
    });
});
