import { describe, expect, it } from "vitest";
import { filterSuccessfulPayments, sumPaymentAmount, SUCCESS_PAYMENT_STATUS } from "../../services/pos/shiftSummary.utils";

describe("shiftSummary utils", () => {
    it("filters only success payments", () => {
        const payments = [
            { amount: 50, status: SUCCESS_PAYMENT_STATUS },
            { amount: 999, status: "Failed" },
            { amount: 10, status: "Pending" },
        ];

        expect(filterSuccessfulPayments(payments)).toEqual([{ amount: 50, status: SUCCESS_PAYMENT_STATUS }]);
    });

    it("sums payment amounts safely", () => {
        expect(sumPaymentAmount([{ amount: 10 }, { amount: "20.5" }, { amount: 0 }])).toBe(30.5);
    });
});

