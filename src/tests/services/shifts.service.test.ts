import { describe, expect, it } from "vitest";
import { filterSuccessfulPayments, sumCashPaymentAmount, sumPaymentAmount } from "../../services/pos/shiftSummary.utils";

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

    it("sums only cash amounts for drawer expectation", () => {
        expect(
            sumCashPaymentAmount([
                { amount: 100, payment_method: { payment_method_name: "Cash", display_name: "เงินสด" } },
                { amount: 250, payment_method: { payment_method_name: "PromptPay", display_name: "พร้อมเพย์" } },
                { amount: "50.5", payment_method: { payment_method_name: "cashbox", display_name: "CASH" } },
            ])
        ).toBe(150.5);
    });
});
