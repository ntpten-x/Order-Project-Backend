import { StockOrdersDetailModel } from "../../models/stock/ordersDetail.model";
import { SocketService } from "../socket.service";
import { LegacyRealtimeEvents, RealtimeEvents } from "../../utils/realtimeEvents";
import { AppError } from "../../utils/AppError";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";

export class OrdersDetailService {
    private socketService = SocketService.getInstance();

    constructor(private ordersDetailModel: StockOrdersDetailModel) { }

    async updatePurchaseDetail(ordersItemId: string, data: { actual_quantity: number; purchased_by_id: string; is_purchased: boolean }, branchId?: string) {
        try {
            const orderItem = await this.ordersDetailModel.getOrderItemWithOrder(ordersItemId, branchId);
            if (!orderItem) {
                throw AppError.notFound("รายการวัตถุดิบในใบซื้อ");
            }

            if (orderItem.orders?.status !== PurchaseOrderStatus.PENDING) {
                throw AppError.conflict("อัปเดตรายการตรวจรับได้เฉพาะใบซื้อที่ยังรอดำเนินการ");
            }

            const savedDetail = await this.ordersDetailModel.createOrUpdate(ordersItemId, data);

            if (orderItem) {
                const emitBranchId = branchId || (orderItem.orders as any)?.branch_id;
                if (emitBranchId) {
                    this.socketService.emitToBranch(emitBranchId, RealtimeEvents.stockOrders.detailUpdate, {
                        orderId: orderItem.orders.id,
                        detail: savedDetail
                    });
                    this.socketService.emitToBranch(emitBranchId, RealtimeEvents.stock.update, {
                        source: "stock-orders-detail",
                        orderId: orderItem.orders.id,
                    });
                    this.socketService.emitToBranch(emitBranchId, LegacyRealtimeEvents.stockOrdersUpdated, {
                        action: "update_item_detail",
                        orderId: orderItem.orders.id,
                        data: savedDetail
                    });
                }
            }

            return savedDetail;
        } catch (error) {
            throw error;
        }
    }

    async getDetailByItemId(ordersItemId: string, branchId?: string) {
        try {
            return await this.ordersDetailModel.findByOrderItemId(ordersItemId, branchId);
        } catch (error) {
            throw error;
        }
    }
}
