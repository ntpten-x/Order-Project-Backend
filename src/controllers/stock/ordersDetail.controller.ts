import { Request, Response } from "express";
import { OrdersDetailService } from "../../services/stock/ordersDetail.service";
import { StockOrdersDetailModel } from "../../models/stock/ordersDetail.model";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";

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
        const branch_id = getBranchId(req as any);

        if (!orders_item_id || !purchased_by_id) {
            throw AppError.badRequest("ไม่พบข้อมูลสินค้าหรือผู้สั่งซื้อ");
        }

        const oldDetail = await this.ordersDetailService.getDetailByItemId(orders_item_id);
        const result = await this.ordersDetailService.updatePurchaseDetail(orders_item_id, {
            actual_quantity,
            purchased_by_id,
            is_purchased: is_purchased ?? true
        }, branch_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_ORDER_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PurchaseOrderItemDetail",
            entity_id: orders_item_id,
            branch_id: branch_id,
            old_values: oldDetail as any,
            new_values: { actual_quantity, purchased_by_id, is_purchased: is_purchased ?? true },
            path: req.originalUrl,
            method: req.method,
            description: `Update stock purchase detail ${orders_item_id}`,
        });

        return ApiResponses.ok(res, result);
    });
}
