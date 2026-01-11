import { Request, Response } from "express";
import { OrdersService } from "../../services/stock/orders.service";
import { OrderStatus } from "../../entity/stock/Orders";

import { OrdersModel } from "../../models/stock/orders.model";

export class OrdersController {
    private ordersModel = new OrdersModel();
    private ordersService = new OrdersService(this.ordersModel);

    createOrder = async (req: Request, res: Response) => {
        try {
            const { ordered_by_id, items, remark } = req.body;
            // Validate input
            if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ message: "ไม่พบข้อมูลการสั่งซื้อ" });
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
            const statusParam = req.query.status as string;
            let statusFilter: OrderStatus | OrderStatus[] | undefined;

            if (statusParam) {
                const statuses = statusParam.split(',') as OrderStatus[];
                // Optional: Validate statuses against OrderStatus enum
                statusFilter = statuses.length > 1 ? statuses : statuses[0];
            }

            const orders = await this.ordersService.getAllOrders(statusFilter ? { status: statusFilter } : undefined);
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
                return res.status(404).json({ message: "ไม่พบข้อมูลการสั่งซื้อ" });
            }
            return res.status(200).json(order);
        } catch (error: any) {
            console.error("Error fetching order:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    updateOrder = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { items } = req.body;

            if (!items || !Array.isArray(items)) {
                return res.status(400).json({ message: "ไม่พบข้อมูลสินค้า" });
            }

            const updatedOrder = await this.ordersService.updateOrder(id, items);
            return res.status(200).json(updatedOrder);
        } catch (error: any) {
            console.error("Error updating order:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }

    updateStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!Object.values(OrderStatus).includes(status)) {
                return res.status(400).json({ message: "ไม่พบข้อมูลสถานะ" });
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
            return res.status(200).json({ message: "การสั่งซื้อลบสำเร็จ" });
        } catch (error: any) {
            console.error("Error deleting order:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }
    confirmPurchase = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { items } = req.body;
            // Assuming user id is available in req.user from auth middleware, but for now getting from body or header if not strict
            // Adjust based on your Auth implementation. Providing default or extracting from req if available.
            // Check if req.user exists (from middleware)
            const purchased_by_id = (req as any).user?.userId || req.body.purchased_by_id;

            if (!items || !Array.isArray(items)) {
                return res.status(400).json({ message: "ไม่พบข้อมูลสินค้า" });
            }

            if (!purchased_by_id) {
                return res.status(400).json({ message: "ไม่พบข้อมูลผู้สั่งซื้อ" });
            }

            const updatedOrder = await this.ordersService.confirmPurchase(id, items, purchased_by_id);
            return res.status(200).json(updatedOrder);
        } catch (error: any) {
            console.error("เกิดข้อผิดพลาดในการยืนยันการสั่งซื้อ:", error);
            return res.status(500).json({ message: "เกิดข้อผิดพลาดในการยืนยันการสั่งซื้อ", error: error.message });
        }
    }
}
