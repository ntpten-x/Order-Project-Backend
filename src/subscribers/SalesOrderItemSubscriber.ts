import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
} from "typeorm";
import { SalesOrder } from "../entity/pos/SalesOrder";
import { SalesOrderItem } from "../entity/pos/SalesOrderItem";
import { SocketService } from "../services/socket.service";
import { buildPublicOrderItemRealtimePayload, buildPublicOrderRealtimePayload } from "../utils/publicRealtime";
import { RealtimeEvents } from "../utils/realtimeEvents";

@EventSubscriber()
export class SalesOrderItemSubscriber implements EntitySubscriberInterface<SalesOrderItem> {

    listenTo() {
        return SalesOrderItem;
    }

    // Helper to get branchId from the relation if possible, or skip emitting.
    // SalesOrderItem -> SalesOrder -> Branch
    // This is tricky because item updates often don't load the full order relation.
    // We might need to query it if it's missing, OR we can rely on the frontend
    // refreshing the whole order list anyway.

    // Strategy:
    // 1. If strict RealtimeEvents are used, we need to know the room (branchId).
    // 2. We can try to load the relation if it's not present.

    private async getOrderRealtimeContext(
        event: InsertEvent<SalesOrderItem> | UpdateEvent<SalesOrderItem> | RemoveEvent<SalesOrderItem>,
        item: SalesOrderItem,
    ): Promise<{ branchId?: string; tableId?: string }> {
        if (item.order && item.order.branch_id) {
            return {
                branchId: item.order.branch_id,
                tableId: item.order.table_id ?? undefined,
            };
        }

        // Fallback: Query the order to get branch_id/table_id
        if (item.order_id) {
            const order = await event.manager.getRepository(SalesOrder).findOne({
                where: { id: item.order_id },
                select: ["branch_id", "table_id"]
            }) as { branch_id?: string; table_id?: string | null } | null;

            return {
                branchId: order?.branch_id,
                tableId: order?.table_id ?? undefined,
            };
        }
        return {};
    }

    async afterInsert(event: InsertEvent<SalesOrderItem>) {
        const item = event.entity;
        const { branchId, tableId } = await this.getOrderRealtimeContext(event, item);

        if (branchId) {
            SocketService.getInstance().emitToBranch(
                branchId,
                RealtimeEvents.salesOrderItem.create,
                item
            );
            // Also emit order update effectively
            SocketService.getInstance().emitToBranch(
                branchId,
                RealtimeEvents.orders.update, // Generic update to trigger refreshing
                { id: item.order_id }
            );
        }

        if (tableId && !event.queryRunner.data?.suppressPublicTableRealtime) {
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.salesOrderItem.create,
                buildPublicOrderItemRealtimePayload(tableId, "create", item.order_id, item.id)
            );
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.orders.update,
                buildPublicOrderRealtimePayload(tableId, "update", item.order_id)
            );
        }
    }

    async afterUpdate(event: UpdateEvent<SalesOrderItem>) {
        const item = event.entity as SalesOrderItem;
        const databaseItem = event.databaseEntity;

        // Use databaseEntity for order_id if updated entity doesn't have it
        const effectiveItem = { ...databaseItem, ...item } as SalesOrderItem;

        const { branchId, tableId } = await this.getOrderRealtimeContext(event, effectiveItem);

        if (branchId) {
            SocketService.getInstance().emitToBranch(
                branchId,
                RealtimeEvents.salesOrderItem.update,
                effectiveItem
            );

            // Trigger order refresh as well
            SocketService.getInstance().emitToBranch(
                branchId,
                RealtimeEvents.orders.update,
                { id: effectiveItem.order_id }
            );
        }

        if (tableId && !event.queryRunner.data?.suppressPublicTableRealtime) {
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.salesOrderItem.update,
                buildPublicOrderItemRealtimePayload(tableId, "update", effectiveItem.order_id, effectiveItem.id)
            );
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.orders.update,
                buildPublicOrderRealtimePayload(tableId, "update", effectiveItem.order_id)
            );
        }
    }

    async afterRemove(event: RemoveEvent<SalesOrderItem>) {
        const item = event.entity || event.databaseEntity;
        if (!item) return;

        const { branchId, tableId } = await this.getOrderRealtimeContext(event, item);

        if (branchId) {
            SocketService.getInstance().emitToBranch(
                branchId,
                RealtimeEvents.salesOrderItem.delete,
                { id: item.id, order_id: item.order_id }
            );
            SocketService.getInstance().emitToBranch(
                branchId,
                RealtimeEvents.orders.update,
                { id: item.order_id }
            );
        }

        if (tableId && !event.queryRunner.data?.suppressPublicTableRealtime) {
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.salesOrderItem.delete,
                buildPublicOrderItemRealtimePayload(tableId, "delete", item.order_id, item.id)
            );
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.orders.update,
                buildPublicOrderRealtimePayload(tableId, "update", item.order_id)
            );
        }
    }
}
