import { OrderStatus } from "../entity/pos/OrderEnums";

// Legacy DB values exist in the enum (pending/completed/cancelled).
// Normalize them to the canonical, capitalized values so:
// - comparisons behave consistently
// - order total recalculation can reliably exclude cancelled items
export const normalizeOrderStatus = (status: unknown): OrderStatus => {
  const s = String(status ?? "").trim();
  if (!Object.values(OrderStatus).includes(s as OrderStatus)) {
    // Keep error handling in callers (services/controllers) where AppError is available.
    throw new Error("Invalid status");
  }

  switch (s as OrderStatus) {
    case OrderStatus.pending:
      return OrderStatus.Pending;
    // Legacy workflow states are now collapsed into Pending.
    case OrderStatus.Cooking:
      return OrderStatus.Pending;
    case OrderStatus.Served:
      return OrderStatus.Pending;
    case OrderStatus.completed:
      return OrderStatus.Completed;
    case OrderStatus.cancelled:
      return OrderStatus.Cancelled;
    default:
      return s as OrderStatus;
  }
};

export const isCancelledStatus = (status: unknown): boolean => {
  return String(status ?? "").trim().toLowerCase() === "cancelled";
};
