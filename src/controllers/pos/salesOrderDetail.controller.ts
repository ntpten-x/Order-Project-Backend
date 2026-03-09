import { Request, Response } from "express";
import { SalesOrderDetailService } from "../../services/pos/salesOrderDetail.service";
import { getBranchId } from "../../middleware/branch.middleware";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

export class SalesOrderDetailController {
    constructor(private salesOrderDetailService: SalesOrderDetailService) { }

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
        const details = await this.salesOrderDetailService.findAll(branchId, this.getAccess(req));
        return ApiResponses.ok(res, details);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const detail = await this.salesOrderDetailService.findOne(req.params.id, branchId, this.getAccess(req));
        if (!detail) throw AppError.notFound("Sales order detail");
        return ApiResponses.ok(res, detail);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const detail = await this.salesOrderDetailService.create(req.body, branchId, this.getAccess(req));

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.ITEM_ADD,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "SalesOrderDetail",
            entity_id: detail.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create sales order detail ${detail.id}`,
        });

        return ApiResponses.created(res, detail);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const access = this.getAccess(req);
        const oldDetail = await this.salesOrderDetailService.findOne(req.params.id, branchId, access);
        const detail = await this.salesOrderDetailService.update(req.params.id, req.body, branchId, access);

        if (detail) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.ITEM_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "SalesOrderDetail",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldDetail as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update sales order detail ${req.params.id}`,
            });
        }
        return ApiResponses.ok(res, detail);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        /* try {
            const branchId = getBranchId(req as any);
            await this.salesOrderDetailService.delete(req.params.id, branchId)
            res.status(200).json({ message: "ลบรายละเอียดเพิ่มเติมสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        } */

        const branchId = getBranchId(req as any);
        const access = this.getAccess(req);
        const oldDetail = await this.salesOrderDetailService.findOne(req.params.id, branchId, access);
        await this.salesOrderDetailService.delete(req.params.id, branchId, access);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.ITEM_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "SalesOrderDetail",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldDetail as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete sales order detail ${req.params.id}`,
        });
        return ApiResponses.noContent(res);
    });
}
