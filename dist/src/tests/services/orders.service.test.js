"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const orderStatus_1 = require("../../utils/orderStatus");
const OrderEnums_1 = require("../../entity/pos/OrderEnums");
(0, vitest_1.describe)("orderStatus utils", () => {
    (0, vitest_1.it)("normalizes legacy status values to canonical status", () => {
        (0, vitest_1.expect)((0, orderStatus_1.normalizeOrderStatus)(OrderEnums_1.OrderStatus.pending)).toBe(OrderEnums_1.OrderStatus.Pending);
        (0, vitest_1.expect)((0, orderStatus_1.normalizeOrderStatus)(OrderEnums_1.OrderStatus.completed)).toBe(OrderEnums_1.OrderStatus.Completed);
        (0, vitest_1.expect)((0, orderStatus_1.normalizeOrderStatus)(OrderEnums_1.OrderStatus.cancelled)).toBe(OrderEnums_1.OrderStatus.Cancelled);
    });
    (0, vitest_1.it)("keeps canonical statuses unchanged", () => {
        (0, vitest_1.expect)((0, orderStatus_1.normalizeOrderStatus)(OrderEnums_1.OrderStatus.Pending)).toBe(OrderEnums_1.OrderStatus.Pending);
        (0, vitest_1.expect)((0, orderStatus_1.normalizeOrderStatus)(OrderEnums_1.OrderStatus.Cancelled)).toBe(OrderEnums_1.OrderStatus.Cancelled);
    });
    (0, vitest_1.it)("detects cancelled status case-insensitively", () => {
        (0, vitest_1.expect)((0, orderStatus_1.isCancelledStatus)(OrderEnums_1.OrderStatus.Cancelled)).toBe(true);
        (0, vitest_1.expect)((0, orderStatus_1.isCancelledStatus)(OrderEnums_1.OrderStatus.cancelled)).toBe(true);
        (0, vitest_1.expect)((0, orderStatus_1.isCancelledStatus)("cancelled")).toBe(true);
        (0, vitest_1.expect)((0, orderStatus_1.isCancelledStatus)(OrderEnums_1.OrderStatus.Pending)).toBe(false);
    });
    (0, vitest_1.it)("throws for invalid statuses", () => {
        (0, vitest_1.expect)(() => (0, orderStatus_1.normalizeOrderStatus)("INVALID")).toThrow("Invalid status");
    });
});
