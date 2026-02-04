import { Request, Response } from "express";
import { SalesOrderItemService } from "../../services/pos/salesOrderItem.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

/**
 * Sales Order Item Controller
 * Following supabase-postgres-best-practices:
 * - Standardized API responses
 * - Consistent error handling
 */
export class SalesOrderItemController {
    constructor(private salesOrderItemService: SalesOrderItemService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const items = await this.salesOrderItemService.findAll(branchId);
        return ApiResponses.ok(res, items);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const item = await this.salesOrderItemService.findOne(req.params.id, branchId);
        if (!item) {
            throw AppError.notFound("รายการสินค้า");
        }
        return ApiResponses.ok(res, item);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const item = await this.salesOrderItemService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.ITEM_ADD,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "SalesOrderItem",
            entity_id: item.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create sales order item ${item.id}`,
        });

        return ApiResponses.created(res, item);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldItem = await this.salesOrderItemService.findOne(req.params.id, branchId);
        const item = await this.salesOrderItemService.update(req.params.id, req.body, branchId);

        if (item) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.ITEM_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "SalesOrderItem",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldItem as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update sales order item ${req.params.id}`,
            });
        }

        if (!item) {
            throw AppError.notFound("รายการสินค้า");
        }
        return ApiResponses.ok(res, item);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldItem = await this.salesOrderItemService.findOne(req.params.id, branchId);
        await this.salesOrderItemService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.ITEM_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "SalesOrderItem",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldItem as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete sales order item ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "ลบรายการสินค้าในออเดอร์สำเร็จ" });
    });
}
