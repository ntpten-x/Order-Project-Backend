import { StockOrdersDetailModel } from "../../models/stock/ordersDetail.model";
import { SocketService } from "../socket.service";

export class OrdersDetailService {
    private socketService = SocketService.getInstance();

    constructor(private ordersDetailModel: StockOrdersDetailModel) { }

    async updatePurchaseDetail(ordersItemId: string, data: { actual_quantity: number; purchased_by_id: string; is_purchased: boolean }, branchId?: string) {
        try {
            const orderItem = await this.ordersDetailModel.getOrderItemWithOrder(ordersItemId, branchId);
            if (!orderItem) {
                throw new Error("Order item not found");
            }

            const savedDetail = await this.ordersDetailModel.createOrUpdate(ordersItemId, data);

            if (orderItem) {
                const emitBranchId = branchId || (orderItem.orders as any)?.branch_id;
                if (emitBranchId) {
                    this.socketService.emitToBranch(emitBranchId, "orders_updated", {
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

    async getDetailByItemId(ordersItemId: string) {
        try {
            return await this.ordersDetailModel.findByOrderItemId(ordersItemId);
        } catch (error) {
            throw error;
        }
    }
}
