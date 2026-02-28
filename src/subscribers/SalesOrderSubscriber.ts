import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
} from "typeorm";
import { SalesOrder } from "../entity/pos/SalesOrder";
import { SocketService } from "../services/socket.service";
import { buildPublicOrderRealtimePayload } from "../utils/publicRealtime";
import { RealtimeEvents } from "../utils/realtimeEvents";

@EventSubscriber()
export class SalesOrderSubscriber implements EntitySubscriberInterface<SalesOrder> {
    private async resolveTableId(
        event: InsertEvent<SalesOrder> | UpdateEvent<SalesOrder> | RemoveEvent<SalesOrder>,
        order: Partial<SalesOrder> | undefined | null,
    ): Promise<string | undefined> {
        const databaseEntity =
            "databaseEntity" in event ? (event.databaseEntity as Partial<SalesOrder> | undefined) : undefined;
        const tableId = order?.table_id || databaseEntity?.table_id;
        if (tableId) {
            return tableId;
        }

        const orderId = order?.id || databaseEntity?.id;
        if (!orderId) {
            return undefined;
        }

        const currentOrder = await event.manager.getRepository(SalesOrder).findOne({
            where: { id: orderId },
            select: ["table_id"],
        });

        return currentOrder?.table_id ?? undefined;
    }

    /**
     * Indicates that this subscriber only listen to SalesOrder events.
     */
    listenTo() {
        return SalesOrder;
    }

    /**
     * Called after entity insertion.
     */
    afterInsert(event: InsertEvent<SalesOrder>) {
        const order = event.entity;
        if (order.branch_id) {
            SocketService.getInstance().emitToBranch(
                order.branch_id,
                RealtimeEvents.orders.create,
                order
            );
        }

        if (event.queryRunner.data?.suppressPublicTableRealtime) {
            return;
        }

        void this.resolveTableId(event, order).then((tableId) => {
            if (!tableId) return;
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.orders.create,
                buildPublicOrderRealtimePayload(tableId, "create", order.id)
            );
        });
    }

    /**
     * Called after entity update.
     */
    async afterUpdate(event: UpdateEvent<SalesOrder>) {
        const order = event.entity as SalesOrder;
        // In some update cases, relation IDs like branch_id might not be loaded if not selected.
        // However, usually we have the id.
        // If branch_id is missing, we might fail to emit to the correct room.
        // A robust solution would be to fetch check, but that adds overhead.
        // For now, we assume critical updates include branch context or we rely on the DB entity having it if loaded.

        // If query builder was used, event.entity might be partial.

        const payload = order ? { ...event.databaseEntity, ...order } : event.databaseEntity;
        if (!payload) {
            return;
        }

        if (order && order.branch_id) {
            SocketService.getInstance().emitToBranch(
                order.branch_id,
                RealtimeEvents.orders.update,
                order
            );
        } else if (event.databaseEntity?.branch_id) {
            // Fallback to databaseEntity if available (previous state)
            // Ideally we want the new state, but for room targeting we use the existing branch_id
            SocketService.getInstance().emitToBranch(
                event.databaseEntity.branch_id,
                RealtimeEvents.orders.update,
                payload
            );
        }

        if (event.queryRunner.data?.suppressPublicTableRealtime) {
            return;
        }

        const tableId = await this.resolveTableId(event, payload);
        if (tableId) {
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.orders.update,
                buildPublicOrderRealtimePayload(tableId, "update", payload.id)
            );
        }
    }

    /**
     * Called after entity removal.
     */
    async afterRemove(event: RemoveEvent<SalesOrder>) {
        const order = event.entity || event.databaseEntity;
        if (order && order.branch_id) {
            SocketService.getInstance().emitToBranch(
                order.branch_id,
                RealtimeEvents.orders.delete,
                { id: order.id }
            );
        }

        if (event.queryRunner.data?.suppressPublicTableRealtime) {
            return;
        }

        const tableId = await this.resolveTableId(event, order);
        if (order?.id && tableId) {
            SocketService.getInstance().emitToPublicTable(
                tableId,
                RealtimeEvents.orders.delete,
                buildPublicOrderRealtimePayload(tableId, "delete", order.id)
            );
        }
    }
}
