import { Request, Response } from "express";
import { DiscountsService } from "../../services/pos/discounts.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

export class DiscountsController {
    constructor(private discountsService: DiscountsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const q = (req.query.q as string | undefined) || undefined;
        const branchId = getBranchId(req as any);
        const discounts = await this.discountsService.findAll(q, branchId);
        return ApiResponses.ok(res, discounts);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const discount = await this.discountsService.findOne(req.params.id, branchId);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    findByName = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const discount = await this.discountsService.findOneByName(req.params.name, branchId);
        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const discount = await this.discountsService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.DISCOUNT_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get('User-Agent'),
            entity_type: 'Discounts',
            entity_id: discount.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create discount ${discount.discount_name || discount.display_name || discount.id}`,
        });
        return ApiResponses.created(res, discount);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }
        const oldDiscount = await this.discountsService.findOne(req.params.id, branchId);
        const discount = await this.discountsService.update(req.params.id, req.body, branchId);

        if (discount) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.DISCOUNT_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Discounts",
                entity_id: req.params.id,
                branch_id: branchId,
                old_values: oldDiscount as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update discount ${req.params.id}`,
            });
        }

        if (!discount) {
            throw AppError.notFound("ส่วนลด");
        }
        return ApiResponses.ok(res, discount);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const oldDiscount = await this.discountsService.findOne(req.params.id, branchId);
        await this.discountsService.delete(req.params.id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.DISCOUNT_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get('User-Agent'),
            entity_type: 'Discounts',
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldDiscount as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete discount ${req.params.id}`,
        });
        return ApiResponses.ok(res, { message: "ลบข้อมูลส่วนลดสำเร็จ" });
    });
}
