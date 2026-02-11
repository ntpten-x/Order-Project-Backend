"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shiftSummary_utils_1 = require("../../services/pos/shiftSummary.utils");
(0, vitest_1.describe)("ShiftsService payment aggregation", () => {
    (0, vitest_1.it)("includes only Success payments", () => {
        const rows = (0, shiftSummary_utils_1.filterSuccessfulPayments)([
            { status: "Success", amount: 100 },
            { status: "Failed", amount: 999 },
            { status: "Pending", amount: 555 },
        ]);
        (0, vitest_1.expect)(rows).toEqual([{ status: "Success", amount: 100 }]);
    });
    (0, vitest_1.it)("sums payment amounts safely", () => {
        (0, vitest_1.expect)((0, shiftSummary_utils_1.sumPaymentAmount)([{ amount: 10 }, { amount: "20.25" }, { amount: undefined }])).toBe(30.25);
    });
});
