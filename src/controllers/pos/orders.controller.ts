import { Response } from "express";
import { OrdersService } from "../../services/pos/orders.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { parseStatusQuery } from "../../utils/statusQuery";
import { AuthRequest } from "../../middleware/auth.middleware";
import { parseCreatedSort } from "../../utils/sortCreated";

export class OrdersController {
    constructor(private ordersService: OrdersService) { }
    private readonly bypassReadCache = process.env.ORDERS_READ_BYPASS_CACHE === "true";
    private setNoStoreHeaders(res: Response): void {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }

    findAll = catchAsync(async (req: AuthRequest, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
        const statuses = parseStatusQuery(req.query.status as string | undefined);
        const type = req.query.type as string;
        const query = req.query.q as string | undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        const result = await this.ordersService.findAll(page, limit, statuses, type, query, branchId, {
            scope: req.permission?.scope,
            actorUserId: req.user?.id,
        }, sortCreated);
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    })

    findSummary = catchAsync(async (req: AuthRequest, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const statuses = parseStatusQuery(req.query.status as string | undefined);
        const type = req.query.type as string;
        const query = req.query.q as string | undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        const result = await this.ordersService.findAllSummary(
            page,
            limit,
            statuses,
            type,
            query,
            branchId,
            { scope: req.permission?.scope, actorUserId: req.user?.id },
            { bypassCache: this.bypassReadCache },
            sortCreated
        );
        this.setNoStoreHeaders(res);
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    })

    getStats = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const stats = await this.ordersService.getStats(
            branchId,
            { scope: req.permission?.scope, actorUserId: req.user?.id },
            { bypassCache: this.bypassReadCache }
        );
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, stats);
    })

    findAllItems = catchAsync(async (req: AuthRequest, res: Response) => {
        const status = req.query.status as string;
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 100;
        const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
        const sortCreated = parseCreatedSort(req.query.sort_created);
        const branchId = getBranchId(req as any);

        const result = await this.ordersService.findAllItems(status, page, limit, branchId, {
            scope: req.permission?.scope,
            actorUserId: req.user?.id,
        }, sortCreated);
        this.setNoStoreHeaders(res);
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit: result.limit,
            total: result.total,
        });
    })

    findOne = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const order = await this.ordersService.findOne(req.params.id, branchId, {
            scope: req.permission?.scope,
            actorUserId: req.user?.id,
        })
        if (!order) {
            throw new AppError("ไม่พบข้อมูลออเดอร์", 404);
        }
        this.setNoStoreHeaders(res);
        return ApiResponses.ok(res, order);
    })

    create = catchAsync(async (req: AuthRequest, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        if (user?.id) {
            req.body.created_by_id = user.id;
        }
        if (branchId) {
            // Always enforce branch isolation server-side (ignore client-provided branch_id)
            req.body.branch_id = branchId;
        }
        // Check if input has items, if so use createFullOrder
        let order;
        if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
            order = await this.ordersService.createFullOrder(req.body, branchId)
        } else {
            order = await this.ordersService.create(req.body, branchId)
        }

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.ORDER_CREATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrder',
            entity_id: order.id,
            branch_id: branchId,
            new_values: { order_no: order.order_no, status: order.status, order_type: order.order_type },
            description: `Created order ${order.order_no}`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.created(res, order);
    })

    update = catchAsync(async (req: AuthRequest, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        if (branchId) {
            // Prevent branch_id tampering
            req.body.branch_id = branchId;
        }

        const oldOrder = await this.ordersService.findOne(req.params.id, branchId);
        const order = await this.ordersService.update(req.params.id, req.body, branchId)

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.ORDER_UPDATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrder',
            entity_id: order.id,
            branch_id: branchId,
            old_values: oldOrder ? { status: oldOrder.status, order_no: oldOrder.order_no } : undefined,
            new_values: { status: order.status, order_no: order.order_no },
            description: `Updated order ${order.order_no}`,
            path: req.path,
            method: req.method,
        });

        // Extra audit for status changes (important operational event)
        if (oldOrder?.status && req.body?.status && String(oldOrder.status) !== String(req.body.status)) {
            await auditLogger.log({
                action_type: AuditActionType.ORDER_STATUS_CHANGE,
                user_id: user?.id,
                username: user?.username,
                ip_address: getClientIp(req),
                user_agent: req.headers['user-agent'],
                entity_type: 'SalesOrder',
                entity_id: order.id,
                branch_id: branchId,
                old_values: { status: oldOrder.status },
                new_values: { status: req.body.status },
                description: `Changed order status ${order.order_no}: ${oldOrder.status} -> ${req.body.status}`,
                path: req.path,
                method: req.method,
            });
        }

        return ApiResponses.ok(res, order);
    })

    delete = catchAsync(async (req: AuthRequest, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        const oldOrder = await this.ordersService.findOne(req.params.id, branchId);

        await this.ordersService.delete(req.params.id, branchId)

        // Audit log - important destructive action
        await auditLogger.log({
            action_type: AuditActionType.ORDER_DELETE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrder',
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldOrder ? { order_no: oldOrder.order_no, status: oldOrder.status } : undefined,
            description: oldOrder ? `Deleted order ${oldOrder.order_no}` : `Deleted order ${req.params.id}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.ok(res, { message: "ลบข้อมูลออเดอร์สำเร็จ" });
    })

    updateItemStatus = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const { status } = req.body
        if (!status) {
            throw new AppError("กรุณาระบุสถานะ", 400);
        }
        await this.ordersService.updateItemStatus(req.params.id, status, branchId)
        return ApiResponses.ok(res, { message: "อัปเดตสถานะสำเร็จ" });
    })

    addItem = catchAsync(async (req: AuthRequest, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        const order = await this.ordersService.addItem(req.params.id, req.body, branchId);

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.ITEM_ADD,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrder',
            entity_id: order.id,
            branch_id: branchId,
            new_values: { product_id: req.body.product_id, quantity: req.body.quantity },
            description: `Added item to order ${order.order_no}`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.created(res, order);
    })

    updateItem = catchAsync(async (req: AuthRequest, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        const order = await this.ordersService.updateItemDetails(req.params.itemId, req.body, branchId);

        // Audit log - item modifications affect bill/operations
        await auditLogger.log({
            action_type: AuditActionType.ITEM_UPDATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrderItem',
            entity_id: req.params.itemId,
            branch_id: branchId,
            new_values: req.body,
            description: order?.order_no ? `Updated item in order ${order.order_no}` : `Updated order item ${req.params.itemId}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.ok(res, order);
    })

    deleteItem = catchAsync(async (req: AuthRequest, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        const order = await this.ordersService.deleteItem(req.params.itemId, branchId);

        // Audit log - item is now soft-cancelled (not hard-deleted)
        await auditLogger.log({
            action_type: AuditActionType.ITEM_UPDATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrderItem',
            entity_id: req.params.itemId,
            branch_id: branchId,
            description: order?.order_no ? `Cancelled item in order ${order.order_no}` : `Cancelled order item ${req.params.itemId}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.ok(res, order);
    })
}
