import { Request, Response } from "express";
import { OrdersDetailService } from "../services/ordersDetail.service";

import { OrdersDetailModel } from "../models/ordersDetail.model";

export class OrdersDetailController {
    private ordersDetailModel = new OrdersDetailModel();
    private ordersDetailService = new OrdersDetailService(this.ordersDetailModel);

    updatePurchase = async (req: Request, res: Response) => {
        try {
            const { orders_item_id, actual_quantity, purchased_by_id, is_purchased } = req.body;

            if (!orders_item_id || !purchased_by_id) {
                return res.status(400).json({ message: "Missing required fields" });
            }

            const result = await this.ordersDetailService.updatePurchaseDetail(orders_item_id, {
                actual_quantity,
                purchased_by_id,
                is_purchased: is_purchased ?? true // Default to true if not sent, assuming calling this API means ticking
            });

            return res.status(200).json(result);
        } catch (error: any) {
            console.error("Error updating purchase detail:", error);
            return res.status(500).json({ message: "Internal server error", error: error.message });
        }
    }
}
