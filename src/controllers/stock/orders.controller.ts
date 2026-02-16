import { Request, Response } from "express";
import { OrdersService } from "../../services/stock/orders.service";
import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersModel } from "../../models/stock/orders.model";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";
import { parseCreatedSort } from "../../utils/sortCreated";

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
        const branch_id = getBranchId(req as any);
        
        // Validate input
        if (!ordered_by_id || !items || !Array.isArray(items) || items.length === 0) {
            throw AppError.badRequest("ไม่พบข้อมูลการสั่งซื้อ");
        }

        const order = await this.ordersService.createOrder(ordered_by_id, items, remark, branch_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_ORDER_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PurchaseOrder",
            entity_id: (order as any).id,
            branch_id: branch_id,
            new_values: { ordered_by_id, items, remark },
            path: req.originalUrl,
            method: req.method,
            description: `Create stock order ${(order as any).id}`,
        });

        return ApiResponses.created(res, order);
    });

    getAllOrders = catchAsync(async (req: Request, res: Response) => {
        const statusParam = req.query.status as string;
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
        const sortCreated = parseCreatedSort(req.query.sort_created);
        
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

        const branch_id = getBranchId(req as any);
        const result = await this.ordersService.getAllOrders(
            statusFilter ? { status: statusFilter } : undefined, 
            page, 
            limit, 
            branch_id,
            sortCreated
        );
        
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    });

    getOrderById = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const branch_id = getBranchId(req as any);
        const order = await this.ordersService.getOrderById(id, branch_id);
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

        const branch_id = getBranchId(req as any);
        const oldOrder = await this.ordersService.getOrderById(id, branch_id);
        if (!oldOrder) {
            throw AppError.notFound("เธเธฒเธฃเธชเธฑเนเธเธเธทเนเธญ");
        }
        const updatedOrder = await this.ordersService.updateOrder(id, items, branch_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_ORDER_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PurchaseOrder",
            entity_id: id,
            branch_id: branch_id,
            old_values: oldOrder as any,
            new_values: { items },
            path: req.originalUrl,
            method: req.method,
            description: `Update stock order ${id}`,
        });
        return ApiResponses.ok(res, updatedOrder);
    });

    updateStatus = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !Object.values(PurchaseOrderStatus).includes(status)) {
            throw AppError.badRequest("สถานะไม่ถูกต้อง");
        }

        const branch_id = getBranchId(req as any);
        const oldOrder = await this.ordersService.getOrderById(id, branch_id);
        if (!oldOrder) {
            throw AppError.notFound("เธเธฒเธฃเธชเธฑเนเธเธเธทเนเธญ");
        }
        const updatedOrder = await this.ordersService.updateStatus(id, status, branch_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_ORDER_STATUS_UPDATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PurchaseOrder",
            entity_id: id,
            branch_id: branch_id,
            old_values: oldOrder as any,
            new_values: { status },
            path: req.originalUrl,
            method: req.method,
            description: `Update stock order status ${id} -> ${status}`,
        });
        return ApiResponses.ok(res, updatedOrder);
    });

    deleteOrder = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const branch_id = getBranchId(req as any);
        const oldOrder = await this.ordersService.getOrderById(id, branch_id);
        if (!oldOrder) {
            throw AppError.notFound("เธเธฒเธฃเธชเธฑเนเธเธเธทเนเธญ");
        }
        const result = await this.ordersService.deleteOrder(id, branch_id);

        if (result?.affected) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.STOCK_ORDER_DELETE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "PurchaseOrder",
                entity_id: id,
                branch_id: branch_id,
                old_values: oldOrder as any,
                path: req.originalUrl,
                method: req.method,
                description: `Delete stock order ${id}`,
            });
        }
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

        const branch_id = getBranchId(req as any);
        const oldOrder = await this.ordersService.getOrderById(id, branch_id);
        if (!oldOrder) {
            throw AppError.notFound("เธเธฒเธฃเธชเธฑเนเธเธเธทเนเธญ");
        }
        const updatedOrder = await this.ordersService.confirmPurchase(id, items, purchased_by_id, branch_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.STOCK_ORDER_CONFIRM_PURCHASE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "PurchaseOrder",
            entity_id: id,
            branch_id: branch_id,
            old_values: oldOrder as any,
            new_values: { items, purchased_by_id },
            path: req.originalUrl,
            method: req.method,
            description: `Confirm purchase for stock order ${id}`,
        });
        return ApiResponses.ok(res, updatedOrder);
    });
}
