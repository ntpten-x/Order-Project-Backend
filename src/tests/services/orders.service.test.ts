import { describe, expect, it } from "vitest";
import { normalizeOrderStatus, isCancelledStatus } from "../../utils/orderStatus";
import { OrderStatus } from "../../entity/pos/OrderEnums";

describe("orderStatus utils", () => {
    it("normalizes legacy status values to canonical status", () => {
        expect(normalizeOrderStatus(OrderStatus.pending)).toBe(OrderStatus.Pending);
        expect(normalizeOrderStatus(OrderStatus.completed)).toBe(OrderStatus.Completed);
        expect(normalizeOrderStatus(OrderStatus.cancelled)).toBe(OrderStatus.Cancelled);
    });

    it("keeps canonical statuses unchanged", () => {
        expect(normalizeOrderStatus(OrderStatus.Pending)).toBe(OrderStatus.Pending);
        expect(normalizeOrderStatus(OrderStatus.Cancelled)).toBe(OrderStatus.Cancelled);
    });

    it("detects cancelled status case-insensitively", () => {
        expect(isCancelledStatus(OrderStatus.Cancelled)).toBe(true);
        expect(isCancelledStatus(OrderStatus.cancelled)).toBe(true);
        expect(isCancelledStatus("cancelled")).toBe(true);
        expect(isCancelledStatus(OrderStatus.Pending)).toBe(false);
    });

    it("throws for invalid statuses", () => {
        expect(() => normalizeOrderStatus("INVALID")).toThrow("Invalid status");
    });
});
