import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SocketService } from "../socket.service";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { recalculateOrderTotal } from "./orderTotals.service";
import { normalizeOrderStatus, isCancelledStatus } from "../../utils/orderStatus";

export class SalesOrderItemService {
    private socketService = SocketService.getInstance();

    constructor(private salesOrderItemModel: SalesOrderItemModels) { }

    private canSyncFromItemStatuses(status: OrderStatus): boolean {
        return (
            status === OrderStatus.Pending ||
            status === OrderStatus.Cooking ||
            status === OrderStatus.Served
        );
    }

    private deriveOrderStatusFromItems(items: SalesOrderItem[]): OrderStatus | null {
        const activeItems = items.filter((item) => !isCancelledStatus(String(item.status)));
        if (activeItems.length === 0) return null;

        activeItems.forEach((item) => {
            normalizeOrderStatus(String(item.status));
        });
        return OrderStatus.Pending;
    }

    private async syncOrderStatusFromItems(orderId: string, branchId?: string): Promise<SalesOrder | null> {
        const orderRepo = getRepository(SalesOrder);
        const itemRepo = getRepository(SalesOrderItem);

        const order = await orderRepo.findOne({
            where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId },
        });
        if (!order) return null;
        if (!this.canSyncFromItemStatuses(order.status)) return order;

        const items = await itemRepo.find({ where: { order_id: orderId } });
        const nextStatus = this.deriveOrderStatusFromItems(items);
        if (nextStatus && nextStatus !== order.status) {
            await orderRepo.update(order.id, { status: nextStatus } as Partial<SalesOrder>);
            order.status = nextStatus;
        }

        return order;
    }

    async findAll(branchId?: string): Promise<SalesOrderItem[]> {
        try {
            return this.salesOrderItemModel.findAll(branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<SalesOrderItem | null> {
        try {
            return this.salesOrderItemModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderItem: SalesOrderItem, branchId?: string): Promise<SalesOrderItem> {
        try {
            if (!salesOrderItem.order_id) {
                throw new Error("กรุณาระบุรหัสออเดอร์")
            }
            if (!salesOrderItem.product_id) {
                throw new Error("กรุณาระบุรหัสสินค้า")
            }

            if (branchId) {
                const orderRepo = getRepository(SalesOrder);
                const order = await orderRepo.findOneBy({ id: salesOrderItem.order_id, branch_id: branchId } as any);
                if (!order) {
                    throw new Error("Order not found for this branch");
                }
            }

            // Normalize legacy status values (e.g. 'cancelled') to canonical casing on write.
            if ((salesOrderItem as any).status !== undefined) {
                (salesOrderItem as any).status = normalizeOrderStatus((salesOrderItem as any).status);
            }

            const createdItem = await this.salesOrderItemModel.create(salesOrderItem)

            // Keep order totals consistent even if this endpoint is used directly.
            await recalculateOrderTotal(createdItem.order_id);
            const syncedOrder = await this.syncOrderStatusFromItems(createdItem.order_id, branchId);
            const effectiveBranchId = syncedOrder?.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, { id: createdItem.order_id } as any);
            }

            const completeItem = await this.salesOrderItemModel.findOne(createdItem.id, branchId)
            if (completeItem) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderItem.create, completeItem)
                }
                return completeItem
            }
            return createdItem
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderItem: Partial<SalesOrderItem>, branchId?: string): Promise<SalesOrderItem> {
        try {
            const itemToUpdate = await this.salesOrderItemModel.findOne(id, branchId)
            if (!itemToUpdate) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข")
            }

            if ((salesOrderItem as any).status !== undefined) {
                (salesOrderItem as any).status = normalizeOrderStatus((salesOrderItem as any).status);
            }

            const updatedItem = await this.salesOrderItemModel.update(id, salesOrderItem, branchId)
            await recalculateOrderTotal(itemToUpdate.order_id);
            const syncedOrder = await this.syncOrderStatusFromItems(itemToUpdate.order_id, branchId);
            const effectiveBranchId = syncedOrder?.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, { id: itemToUpdate.order_id } as any);
            }
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderItem.update, updatedItem)
            }
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const item = await this.salesOrderItemModel.findOne(id, branchId)
            await this.salesOrderItemModel.delete(id, branchId)
            if (item?.order_id) {
                await recalculateOrderTotal(item.order_id);
                const syncedOrder = await this.syncOrderStatusFromItems(item.order_id, branchId);
                const effectiveBranchId = syncedOrder?.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, { id: item.order_id } as any);
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderItem.delete, { id })
                }
            } else if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderItem.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
