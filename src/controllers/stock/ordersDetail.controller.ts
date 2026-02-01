import { Request, Response } from "express";
import { OrdersDetailService } from "../../services/stock/ordersDetail.service";
import { StockOrdersDetailModel } from "../../models/stock/ordersDetail.model";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Orders Detail Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
export class OrdersDetailController {
    private ordersDetailModel = new StockOrdersDetailModel();
    private ordersDetailService = new OrdersDetailService(this.ordersDetailModel);

    updatePurchase = catchAsync(async (req: Request, res: Response) => {
        const { orders_item_id, actual_quantity, purchased_by_id, is_purchased } = req.body;

        if (!orders_item_id || !purchased_by_id) {
            throw AppError.badRequest("ไม่พบข้อมูลสินค้าหรือผู้สั่งซื้อ");
        }

        const result = await this.ordersDetailService.updatePurchaseDetail(orders_item_id, {
            actual_quantity,
            purchased_by_id,
            is_purchased: is_purchased ?? true
        });

        return ApiResponses.ok(res, result);
    });
}
