import { Request, Response, NextFunction } from "express";
import { OrdersService } from "../../services/pos/orders.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

export class OrdersController {
    constructor(private ordersService: OrdersService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
        const statuses = req.query.status ? (req.query.status as string).split(',') : undefined;
        const type = req.query.type as string;
        const query = req.query.q as string | undefined;
        const branchId = (req as any).user?.branch_id;

        const result = await this.ordersService.findAll(page, limit, statuses, type, query, branchId)
        res.status(200).json(result)
    })

    findSummary = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(limitRaw, 1), 200);
        const statuses = req.query.status ? (req.query.status as string).split(',') : undefined;
        const type = req.query.type as string;
        const query = req.query.q as string | undefined;
        const branchId = (req as any).user?.branch_id;

        const result = await this.ordersService.findAllSummary(page, limit, statuses, type, query, branchId);
        res.status(200).json(result);
    })

    getStats = catchAsync(async (req: Request, res: Response) => {
        const branchId = (req as any).user?.branch_id;
        const stats = await this.ordersService.getStats(branchId);
        res.status(200).json(stats);
    })

    findAllItems = catchAsync(async (req: Request, res: Response) => {
        const status = req.query.status as string;
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const limitRaw = parseInt(req.query.limit as string) || 100;
        const limit = Math.min(Math.max(limitRaw, 1), 200); // cap to prevent huge payloads
        const branchId = (req as any).user?.branch_id;

        const result = await this.ordersService.findAllItems(status, page, limit, branchId);
        res.status(200).json(result);
    })

    findOne = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.findOne(req.params.id)
        if (!order) {
            throw new AppError("ไม่พบข้อมูลออเดอร์", 404);
        }
        res.status(200).json(order)
    })

    create = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        if (user?.id && !req.body.created_by_id) {
            req.body.created_by_id = user.id;
        }
        if (user?.branch_id && !req.body.branch_id) {
            req.body.branch_id = user.branch_id;
        }
        // Check if input has items, if so use createFullOrder
        let order;
        if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
            order = await this.ordersService.createFullOrder(req.body)
        } else {
            order = await this.ordersService.create(req.body)
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
            branch_id: user?.branch_id,
            new_values: { order_no: order.order_no, status: order.status, order_type: order.order_type },
            description: `Created order ${order.order_no}`,
            path: req.path,
            method: req.method,
        });
        
        res.status(201).json(order)
    })

    update = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const oldOrder = await this.ordersService.findOne(req.params.id);
        const order = await this.ordersService.update(req.params.id, req.body)
        
        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.ORDER_UPDATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrder',
            entity_id: order.id,
            branch_id: user?.branch_id,
            old_values: oldOrder ? { status: oldOrder.status, order_no: oldOrder.order_no } : undefined,
            new_values: { status: order.status, order_no: order.order_no },
            description: `Updated order ${order.order_no}`,
            path: req.path,
            method: req.method,
        });
        
        res.status(200).json(order)
    })

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.ordersService.delete(req.params.id)
        res.status(200).json({ message: "ลบข้อมูลออเดอร์สำเร็จ" })
    })

    updateItemStatus = catchAsync(async (req: Request, res: Response) => {
        const { status } = req.body
        if (!status) {
            throw new AppError("กรุณาระบุสถานะ", 400);
        }
        await this.ordersService.updateItemStatus(req.params.id, status)
        res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" })
    })

    addItem = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const order = await this.ordersService.addItem(req.params.id, req.body);
        
        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.ITEM_ADD,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'SalesOrder',
            entity_id: order.id,
            branch_id: user?.branch_id,
            new_values: { product_id: req.body.product_id, quantity: req.body.quantity },
            description: `Added item to order ${order.order_no}`,
            path: req.path,
            method: req.method,
        });
        
        res.status(201).json(order);
    })

    updateItem = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.updateItemDetails(req.params.itemId, req.body);
        res.status(200).json(order);
    })

    deleteItem = catchAsync(async (req: Request, res: Response) => {
        const order = await this.ordersService.deleteItem(req.params.itemId);
        res.status(200).json(order);
    })
}
