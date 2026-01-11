import { OrdersDetailModel } from "../../models/stock/ordersDetail.model";
import { SocketService } from "../socket.service";

export class OrdersDetailService {
    private socketService = SocketService.getInstance();

    constructor(private ordersDetailModel: OrdersDetailModel) { }

    async updatePurchaseDetail(ordersItemId: string, data: { actual_quantity: number; purchased_by_id: string; is_purchased: boolean }) {
        try {
            const savedDetail = await this.ordersDetailModel.createOrUpdate(ordersItemId, data);

            // Fetch related info for socket
            const orderItem = await this.ordersDetailModel.getOrderItemWithOrder(ordersItemId);

            if (orderItem) {
                this.socketService.emit("orders_updated", {
                    action: "update_item_detail",
                    orderId: orderItem.orders.id,
                    data: savedDetail
                });
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
