import { Request, Response } from "express";
import { DeliveryService } from "../../services/pos/delivery.service";
import { getBranchId } from "../../middleware/branch.middleware";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

export class DeliveryController {
    constructor(private deliveryService: DeliveryService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);

        const result = await this.deliveryService.findAll(page, limit, q, branchId);
        return ApiResponses.paginated(res, result.data, {
            page: result.page,
            limit,
            total: result.total,
        });
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const delivery = await this.deliveryService.findOne(req.params.id, branchId);
        if (!delivery) throw AppError.notFound("Delivery");
        return ApiResponses.ok(res, delivery);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const delivery = await this.deliveryService.findOneByName(req.params.name, branchId);
        if (!delivery) throw AppError.notFound("Delivery");
        return ApiResponses.ok(res, delivery);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const delivery = await this.deliveryService.create(req.body);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.DELIVERY_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Delivery",
            entity_id: (delivery as any).id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create delivery ${(delivery as any).delivery_name || (delivery as any).id}`,
        });

        return ApiResponses.created(res, delivery);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldDelivery = await this.deliveryService.findOne(req.params.id, branchId);
        const delivery = await this.deliveryService.update(req.params.id, req.body, branchId);

        if (delivery) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.DELIVERY_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Delivery",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldDelivery as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update delivery ${req.params.id}`,
            });
        }
        return ApiResponses.ok(res, delivery);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        /* try {
            const branchId = getBranchId(req as any);
            await this.deliveryService.delete(req.params.id, branchId)
            res.status(200).json({ message: "ลบข้อมูลบริการส่งสำเร็จ" })
        } catch (error: any) {
            res.status(500).json({ error: error.message })
        } */

        const branchId = getBranchId(req as any);
        const oldDelivery = await this.deliveryService.findOne(req.params.id, branchId);
        await this.deliveryService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.DELIVERY_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Delivery",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldDelivery as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete delivery ${req.params.id}`,
        });
        return ApiResponses.noContent(res);
    });
}
