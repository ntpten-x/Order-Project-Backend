import { Orders, OrderStatus } from "../../entity/stock/Orders";
import { OrdersModel } from "../../models/stock/orders.model";
import { SocketService } from "../socket.service";

export class OrdersService {
    private socketService = SocketService.getInstance();

    constructor(private ordersModel: OrdersModel) { }

    async createOrder(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string) {
        try {
            const completeOrder = await this.ordersModel.createOrderWithItems(orderedById, items, remark);
            this.socketService.emit("orders_updated", { action: "create", data: completeOrder });
            return completeOrder;
        } catch (error) {
            throw error;
        }
    }

    async getAllOrders(filters?: { status?: OrderStatus | OrderStatus[] }, page: number = 1, limit: number = 50) {
        try {
            return await this.ordersModel.findAll(filters, page, limit);
        } catch (error) {
            throw error;
        }
    }

    async getOrderById(id: string) {
        try {
            return await this.ordersModel.findById(id);
        } catch (error) {
            throw error;
        }
    }

    async updateOrder(id: string, items: { ingredient_id: string; quantity_ordered: number }[]) {
        try {
            const updatedOrder = await this.ordersModel.updateOrderItems(id, items);
            this.socketService.emit("orders_updated", { action: "update_order", data: updatedOrder });
            return updatedOrder;
        } catch (error) {
            throw error;
        }
    }

    async updateStatus(id: string, status: OrderStatus) {
        try {
            const updatedOrder = await this.ordersModel.updateStatus(id, status);
            if (!updatedOrder) throw new Error("ไม่พบข้อมูลการสั่งซื้อ");

            this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
            return updatedOrder;
        } catch (error) {
            throw error;
        }
    }

    async deleteOrder(id: string) {
        try {
            const deleted = await this.ordersModel.delete(id);
            if (deleted) {
                this.socketService.emit("orders_updated", { action: "delete", id });
            }
            return { affected: deleted ? 1 : 0 };
        } catch (error) {
            throw error;
        }
    }
    async confirmPurchase(id: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string) {
        try {
            const updatedOrder = await this.ordersModel.confirmPurchase(id, items, purchasedById);
            this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
            return updatedOrder;
        } catch (error) {
            throw error;
        }
    }
}
