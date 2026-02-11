"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCancelledStatus = exports.normalizeOrderStatus = void 0;
const OrderEnums_1 = require("../entity/pos/OrderEnums");
// Legacy DB values exist in the enum (pending/completed/cancelled).
// Normalize them to the canonical, capitalized values so:
// - comparisons behave consistently
// - order total recalculation can reliably exclude cancelled items
const normalizeOrderStatus = (status) => {
    const s = String(status !== null && status !== void 0 ? status : "").trim();
    if (!Object.values(OrderEnums_1.OrderStatus).includes(s)) {
        // Keep error handling in callers (services/controllers) where AppError is available.
        throw new Error("Invalid status");
    }
    switch (s) {
        case OrderEnums_1.OrderStatus.pending:
            return OrderEnums_1.OrderStatus.Pending;
        case OrderEnums_1.OrderStatus.completed:
            return OrderEnums_1.OrderStatus.Completed;
        case OrderEnums_1.OrderStatus.cancelled:
            return OrderEnums_1.OrderStatus.Cancelled;
        default:
            return s;
    }
};
exports.normalizeOrderStatus = normalizeOrderStatus;
const isCancelledStatus = (status) => {
    return String(status !== null && status !== void 0 ? status : "").trim().toLowerCase() === "cancelled";
};
exports.isCancelledStatus = isCancelledStatus;
