import { Request, Response } from "express";
import { OrdersService } from "../../services/stock/orders.service";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersModel } from "../../models/stock/orders.model";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";

/**
 * Stock Orders Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 * - Input validation
 */
export class OrdersController {
    private ordersModel = new StockOrdersModel();
    private ordersService = new OrdersService(this.ordersModel);

    createOrder = catchAsync(async (req: Request, res: Response) => {
        const { ordered_by_id, items, remark } = req.body;
        const branch_id = (req as any).user?.branch_id;
        
        // Validate input
        if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
            throw AppError.badRequest("ไม่พบข้อมูลการสั่งซื้อ");
        }

        const order = await this.ordersService.createOrder(ordered_by_id, items, remark, branch_id);
        return ApiResponses.created(res, order);
    });

    getAllOrders = catchAsync(async (req: Request, res: Response) => {
        const statusParam = req.query.status as string;
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
        
        let statusFilter: PurchaseOrderStatus | PurchaseOrderStatus[] | undefined;

        if (statusParam) {
            const statuses = statusParam.split(',') as PurchaseOrderStatus[];
            // Validate statuses
            const validStatuses = statuses.filter(s => Object.values(PurchaseOrderStatus).includes(s));
            if (validStatuses.length === 0) {
                throw AppError.badRequest("สถานะไม่ถูกต้อง");
            }
            statusFilter = validStatuses.length > 1 ? validStatuses : validStatuses[0];
        }

        const branch_id = (req as any).user?.branch_id;
        const result = await this.ordersService.getAllOrders(
            statusFilter ? { status: statusFilter } : undefined, 
            page, 
            limit, 
            branch_id
        );
        
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    });

    getOrderById = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const order = await this.ordersService.getOrderById(id);
        if (!order) {
            throw AppError.notFound("การสั่งซื้อ");
        }
        return ApiResponses.ok(res, order);
    });

    updateOrder = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw AppError.badRequest("ไม่พบข้อมูลสินค้า");
        }

        const updatedOrder = await this.ordersService.updateOrder(id, items);
        return ApiResponses.ok(res, updatedOrder);
    });

    updateStatus = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !Object.values(PurchaseOrderStatus).includes(status)) {
            throw AppError.badRequest("สถานะไม่ถูกต้อง");
        }

        const updatedOrder = await this.ordersService.updateStatus(id, status);
        return ApiResponses.ok(res, updatedOrder);
    });

    deleteOrder = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const result = await this.ordersService.deleteOrder(id);
        if (!result || result.affected === 0) {
            throw AppError.notFound("การสั่งซื้อ");
        }
        return ApiResponses.ok(res, { message: "การสั่งซื้อลบสำเร็จ" });
    });

    confirmPurchase = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { items } = req.body;
        const purchased_by_id = (req as any).user?.id || (req as any).user?.userId || req.body.purchased_by_id;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw AppError.badRequest("ไม่พบข้อมูลสินค้า");
        }

        if (!purchased_by_id) {
            throw AppError.badRequest("ไม่พบข้อมูลผู้สั่งซื้อ");
        }

        const updatedOrder = await this.ordersService.confirmPurchase(id, items, purchased_by_id);
        return ApiResponses.ok(res, updatedOrder);
    });
}
