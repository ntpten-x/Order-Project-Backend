"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const statusQuery_1 = require("../../utils/statusQuery");
(0, vitest_1.describe)("parseStatusQuery", () => {
    (0, vitest_1.it)("returns undefined when query is empty", () => {
        (0, vitest_1.expect)((0, statusQuery_1.parseStatusQuery)(undefined)).toBeUndefined();
        (0, vitest_1.expect)((0, statusQuery_1.parseStatusQuery)("")).toBeUndefined();
        (0, vitest_1.expect)((0, statusQuery_1.parseStatusQuery)(" , , ")).toBeUndefined();
    });
    (0, vitest_1.it)("trims and removes empty statuses", () => {
        (0, vitest_1.expect)((0, statusQuery_1.parseStatusQuery)("Paid, Completed,, Cancelled  ")).toEqual([
            "Paid",
            "Completed",
            "Cancelled",
        ]);
    });
});
