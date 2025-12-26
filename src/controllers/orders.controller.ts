import { Request, Response } from "express";
import { OrdersService } from "../services/orders.service";
import { OrderStatus } from "../entity/Orders";

import { OrdersModel } from "../models/orders.model";

export class OrdersController {
    private ordersModel = new OrdersModel();
    private ordersService = new OrdersService(this.ordersModel);

    createOrder = async (req: Request, res: Response) => {
        try {
            const { ordered_by_id, items, remark } = req.body;
            // Validate input
            if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ message: "Invalid order data" });
            }

            const order = await this.ordersService.createOrder(ordered_by_id, items, remark);
            return res.status(201).json(order);
        } catch (error: any) {
            console.error("Error creating order:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    getAllOrders = async (req: Request, res: Response) => {
        try {
            const orders = await this.ordersService.getAllOrders();
            return res.status(200).json(orders);
        } catch (error: any) {
            console.error("Error fetching orders:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    getOrderById = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const order = await this.ordersService.getOrderById(id);
            if (!order) {
                return res.status(404).json({ message: "Order not found" });
            }
            return res.status(200).json(order);
        } catch (error: any) {
            console.error("Error fetching order:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    updateStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!Object.values(OrderStatus).includes(status)) {
                return res.status(400).json({ message: "Invalid status" });
            }

            const updatedOrder = await this.ordersService.updateStatus(id, status);
            return res.status(200).json(updatedOrder);
        } catch (error: any) {
            console.error("Error updating order status:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    deleteOrder = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await this.ordersService.deleteOrder(id);
            return res.status(200).json({ message: "Order deleted successfully" });
        } catch (error: any) {
            console.error("Error deleting order:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }
}
