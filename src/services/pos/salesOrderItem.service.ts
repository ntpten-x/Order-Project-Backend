import { SalesOrderItemModels } from "../../models/pos/salesOrderItem.model";
import { SocketService } from "../socket.service";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus, ServingStatus } from "../../entity/pos/OrderEnums";
import { getRepository } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { recalculateOrderTotal } from "./orderTotals.service";
import { normalizeOrderStatus, isCancelledStatus } from "../../utils/orderStatus";
import { randomUUID } from "crypto";
import { AppError } from "../../utils/AppError";
import { bumpOrderReadModelVersions, invalidateOrderReadCaches } from "./ordersReadCache.utils";
import { OrderSummarySnapshotService } from "./orderSummarySnapshot.service";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class SalesOrderItemService {
    private socketService = SocketService.getInstance();
    private orderSummarySnapshotService = new OrderSummarySnapshotService();

    constructor(private salesOrderItemModel: SalesOrderItemModels) { }

    private async invalidateOrderReadModels(branchId?: string): Promise<void> {
        await bumpOrderReadModelVersions(branchId);
        invalidateOrderReadCaches(branchId);
    }

    private async emitOrderUpdate(orderId: string, branchId?: string, status?: OrderStatus | null): Promise<void> {
        if (!branchId) return;

        const summarySnapshot = await this.orderSummarySnapshotService.getPayload(orderId);
        this.socketService.emitToBranch(branchId, RealtimeEvents.orders.update, {
            id: orderId,
            status: status ?? summarySnapshot?.status ?? undefined,
            summary_snapshot: summarySnapshot,
        });
    }

    private canSyncFromItemStatuses(status: OrderStatus): boolean {
        return (
            status === OrderStatus.Pending ||
            status === OrderStatus.Cooking ||
            status === OrderStatus.Served
        );
    }

    private deriveOrderStatusFromItems(items: SalesOrderItem[]): OrderStatus | null {
        if (items.length === 0) return null;

        const activeItems = items.filter((item) => !isCancelledStatus(String(item.status)));
        if (activeItems.length === 0) return OrderStatus.Cancelled;

        activeItems.forEach((item) => {
            normalizeOrderStatus(String(item.status));
        });
        return OrderStatus.Pending;
    }

    private async findAccessibleOrder(
        orderId: string,
        branchId?: string,
        access?: AccessContext,
    ): Promise<SalesOrder | null> {
        const orderRepo = getRepository(SalesOrder);
        const query = orderRepo
            .createQueryBuilder("order")
            .where("order.id = :orderId", { orderId });

        if (branchId) {
            query.andWhere("order.branch_id = :branchId", { branchId });
        }

        if (access?.scope === "none") {
            query.andWhere("1=0");
        }

        if (access?.scope === "own") {
            if (!access.actorUserId) {
                query.andWhere("1=0");
            } else {
                query.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
            }
        }

        return query.getOne();
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

    async findAll(branchId?: string, access?: AccessContext): Promise<SalesOrderItem[]> {
        try {
            return this.salesOrderItemModel.findAll(branchId, access)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrderItem | null> {
        try {
            return this.salesOrderItemModel.findOne(id, branchId, access)
        } catch (error) {
            throw error
        }
    }

    async create(salesOrderItem: SalesOrderItem, branchId?: string, access?: AccessContext): Promise<SalesOrderItem> {
        try {
            if (!salesOrderItem.order_id) {
                throw new Error("กรุณาระบุรหัสออเดอร์")
            }
            if (!salesOrderItem.product_id) {
                throw new Error("กรุณาระบุรหัสสินค้า")
            }

            if (branchId || access?.scope) {
                const order = await this.findAccessibleOrder(salesOrderItem.order_id, branchId, access);
                if (!order) {
                    if (access?.scope === "own" || access?.scope === "none") {
                        throw AppError.forbidden("Access denied");
                    }
                    throw AppError.notFound("Order");
                }
            }

            // Normalize legacy status values (e.g. 'cancelled') to canonical casing on write.
            if ((salesOrderItem as any).status !== undefined) {
                (salesOrderItem as any).status = normalizeOrderStatus((salesOrderItem as any).status);
            }

            if (!salesOrderItem.serving_group_id) {
                salesOrderItem.serving_group_id = randomUUID();
            }
            if (!salesOrderItem.serving_group_created_at) {
                salesOrderItem.serving_group_created_at = new Date();
            }
            if (!salesOrderItem.serving_status) {
                salesOrderItem.serving_status = ServingStatus.PendingServe;
            }

            const createdItem = await this.salesOrderItemModel.create(salesOrderItem)

            // Keep order totals consistent even if this endpoint is used directly.
            await recalculateOrderTotal(createdItem.order_id);
            const syncedOrder = await this.syncOrderStatusFromItems(createdItem.order_id, branchId);
            const effectiveBranchId = syncedOrder?.branch_id || branchId;
            await this.orderSummarySnapshotService.syncOrder(createdItem.order_id);
            await this.invalidateOrderReadModels(effectiveBranchId);

            const completeItem = await this.salesOrderItemModel.findOne(createdItem.id, branchId, access)
            if (completeItem) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderItem.create, completeItem)
                    await this.emitOrderUpdate(createdItem.order_id, effectiveBranchId, syncedOrder?.status);
                }
                return completeItem
            }
            return createdItem
        } catch (error) {
            throw error
        }
    }

    async update(id: string, salesOrderItem: Partial<SalesOrderItem>, branchId?: string, access?: AccessContext): Promise<SalesOrderItem> {
        try {
            const itemToUpdate = await this.salesOrderItemModel.findOne(id, branchId, access)
            if (!itemToUpdate) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการแก้ไข")
            }

            if ((salesOrderItem as any).status !== undefined) {
                (salesOrderItem as any).status = normalizeOrderStatus((salesOrderItem as any).status);
            }

            const updatedItem = await this.salesOrderItemModel.update(id, salesOrderItem, branchId, access)
            await recalculateOrderTotal(itemToUpdate.order_id);
            const syncedOrder = await this.syncOrderStatusFromItems(itemToUpdate.order_id, branchId);
            const effectiveBranchId = syncedOrder?.branch_id || branchId;
            await this.orderSummarySnapshotService.syncOrder(itemToUpdate.order_id);
            await this.invalidateOrderReadModels(effectiveBranchId);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderItem.update, updatedItem)
                await this.emitOrderUpdate(itemToUpdate.order_id, effectiveBranchId, syncedOrder?.status);
            }
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        try {
            const item = await this.salesOrderItemModel.findOne(id, branchId, access)
            await this.salesOrderItemModel.delete(id, branchId, access)
            if (item?.order_id) {
                await recalculateOrderTotal(item.order_id);
                const syncedOrder = await this.syncOrderStatusFromItems(item.order_id, branchId);
                const effectiveBranchId = syncedOrder?.branch_id || branchId;
                await this.orderSummarySnapshotService.syncOrder(item.order_id);
                await this.invalidateOrderReadModels(effectiveBranchId);
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.salesOrderItem.delete, { id })
                    await this.emitOrderUpdate(item.order_id, effectiveBranchId, syncedOrder?.status);
                }
            } else if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.salesOrderItem.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
