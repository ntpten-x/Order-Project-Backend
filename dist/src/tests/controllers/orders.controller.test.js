"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const statusQuery_1 = require("../../utils/statusQuery");
(0, vitest_1.describe)("OrdersController status parsing", () => {
    (0, vitest_1.it)("parses and trims statuses from query string", () => {
        (0, vitest_1.expect)((0, statusQuery_1.parseStatusQuery)("Paid, Completed,Cancelled")).toEqual([
            "Paid",
            "Completed",
            "Cancelled",
        ]);
    });
    (0, vitest_1.it)("removes empty values from query string", () => {
        (0, vitest_1.expect)((0, statusQuery_1.parseStatusQuery)("Paid, , ,Cancelled")).toEqual(["Paid", "Cancelled"]);
    });
});
