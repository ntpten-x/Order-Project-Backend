import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
} from "typeorm";
import { SalesOrder } from "../entity/pos/SalesOrder";
import { SocketService } from "../services/socket.service";
import { RealtimeEvents } from "../utils/realtimeEvents";

@EventSubscriber()
export class SalesOrderSubscriber implements EntitySubscriberInterface<SalesOrder> {
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
    }

    /**
     * Called after entity update.
     */
    afterUpdate(event: UpdateEvent<SalesOrder>) {
        const order = event.entity as SalesOrder;
        // In some update cases, relation IDs like branch_id might not be loaded if not selected.
        // However, usually we have the id.
        // If branch_id is missing, we might fail to emit to the correct room.
        // A robust solution would be to fetch check, but that adds overhead.
        // For now, we assume critical updates include branch context or we rely on the DB entity having it if loaded.

        // If query builder was used, event.entity might be partial.

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
                { ...event.databaseEntity, ...order }
            );
        }
    }

    /**
     * Called after entity removal.
     */
    afterRemove(event: RemoveEvent<SalesOrder>) {
        const order = event.entity || event.databaseEntity;
        if (order && order.branch_id) {
            SocketService.getInstance().emitToBranch(
                order.branch_id,
                RealtimeEvents.orders.delete,
                { id: order.id }
            );
        }
    }
}
