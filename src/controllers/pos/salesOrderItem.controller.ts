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

    private getAccess(req: Request) {
        const scope = (req as any).permission?.scope;
        const actorUserId = (req as any).user?.id;
        if (scope === "own" && !actorUserId) {
            return { scope: "none" as const };
        }
        return {
            scope,
            actorUserId,
        };
    }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const items = await this.salesOrderItemService.findAll(branchId, this.getAccess(req));
        return ApiResponses.ok(res, items);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const item = await this.salesOrderItemService.findOne(req.params.id, branchId, this.getAccess(req));
        if (!item) {
            throw AppError.notFound("รายการสินค้า");
        }
        return ApiResponses.ok(res, item);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const item = await this.salesOrderItemService.create(req.body, branchId, this.getAccess(req));

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
        const access = this.getAccess(req);
        const oldItem = await this.salesOrderItemService.findOne(req.params.id, branchId, access);
        const item = await this.salesOrderItemService.update(req.params.id, req.body, branchId, access);

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
        const access = this.getAccess(req);
        const oldItem = await this.salesOrderItemService.findOne(req.params.id, branchId, access);
        await this.salesOrderItemService.delete(req.params.id, branchId, access);

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
