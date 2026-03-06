export type PublicRealtimeEntity = "order" | "order-item";
export type PublicRealtimeAction = "create" | "update" | "delete";

export type PublicRealtimePayload = {
    tableId: string;
    orderId?: string;
    itemId?: string;
    entity: PublicRealtimeEntity;
    action: PublicRealtimeAction;
};

export function buildPublicOrderRealtimePayload(
    tableId: string,
    action: PublicRealtimeAction,
    orderId?: string,
): PublicRealtimePayload {
    return {
        tableId,
        orderId,
        entity: "order",
        action,
    };
}

export function buildPublicOrderItemRealtimePayload(
    tableId: string,
    action: PublicRealtimeAction,
    orderId?: string,
    itemId?: string,
): PublicRealtimePayload {
    return {
        tableId,
        orderId,
        itemId,
        entity: "order-item",
        action,
    };
}
