"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shiftSummary_utils_1 = require("../../services/pos/shiftSummary.utils");
(0, vitest_1.describe)("shiftSummary utils", () => {
    (0, vitest_1.it)("filters only success payments", () => {
        const payments = [
            { amount: 50, status: shiftSummary_utils_1.SUCCESS_PAYMENT_STATUS },
            { amount: 999, status: "Failed" },
            { amount: 10, status: "Pending" },
        ];
        (0, vitest_1.expect)((0, shiftSummary_utils_1.filterSuccessfulPayments)(payments)).toEqual([{ amount: 50, status: shiftSummary_utils_1.SUCCESS_PAYMENT_STATUS }]);
    });
    (0, vitest_1.it)("sums payment amounts safely", () => {
        (0, vitest_1.expect)((0, shiftSummary_utils_1.sumPaymentAmount)([{ amount: 10 }, { amount: "20.5" }, { amount: 0 }])).toBe(30.5);
    });
});
