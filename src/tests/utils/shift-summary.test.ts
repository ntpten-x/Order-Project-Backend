import { describe, expect, it } from "vitest";
import {
    filterSuccessfulPayments,
    isCashPayment,
    sumCashPaymentAmount,
    sumPaymentAmount,
    SUCCESS_PAYMENT_STATUS
} from "../../services/pos/shiftSummary.utils";

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

    it("detects cash payments by method name/display name", () => {
        expect(
            isCashPayment({
                amount: 100,
                payment_method: { payment_method_name: "Cash Drawer", display_name: "เงินสด" },
            })
        ).toBe(true);

        expect(
            isCashPayment({
                amount: 100,
                payment_method: { payment_method_name: "PromptPay", display_name: "พร้อมเพย์" },
            })
        ).toBe(false);
    });

    it("sums only cash payment amounts", () => {
        expect(
            sumCashPaymentAmount([
                { amount: 10, payment_method: { payment_method_name: "Cash", display_name: "เงินสด" } },
                { amount: "20.5", payment_method: { payment_method_name: "cash_counter", display_name: "CASH" } },
                { amount: 30, payment_method: { payment_method_name: "PromptPay", display_name: "พร้อมเพย์" } },
            ])
        ).toBe(30.5);
    });
});
