import { Request, Response } from "express";
import { PromotionsService } from "../../services/pos/promotions.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";

export class PromotionsController {
    private promotionsService = new PromotionsService();

    /**
     * Validate promotion code
     */
    validatePromotion = catchAsync(async (req: AuthRequest, res: Response) => {
        const { code, orderItems, totalAmount } = req.body;
        const branchId = getBranchId(req as any);

        if (!code) {
            throw AppError.badRequest("Promotion code is required");
        }

        if (!orderItems || !Array.isArray(orderItems)) {
            throw AppError.badRequest("Order items are required");
        }

        const result = await this.promotionsService.validatePromotionCode(
            code,
            orderItems,
            totalAmount || 0,
            branchId
        );

        return ApiResponses.ok(res, result);
    });

    /**
     * Apply promotion
     */
    applyPromotion = catchAsync(async (req: AuthRequest, res: Response) => {
        const { code } = req.body;
        const branchId = getBranchId(req as any);

        if (!code) {
            throw AppError.badRequest("Promotion code is required");
        }

        const promotion = await this.promotionsService.applyPromotion(code, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PROMOTION_APPLY,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Promotions",
            entity_id: (promotion as any)?.id,
            branch_id: branchId,
            new_values: { code },
            path: req.originalUrl,
            method: req.method,
            description: `Apply promotion ${code}`,
        });

        return ApiResponses.ok(res, promotion);
    });

    /**
     * Get active promotions
     */
    getActivePromotions = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);

        const promotions = await this.promotionsService.getActivePromotions(branchId);

        return ApiResponses.ok(res, promotions);
    });

    /**
     * Get all promotions
     */
    getAll = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

        const promotions = await this.promotionsService.getAll(branchId, isActive);

        return ApiResponses.ok(res, promotions);
    });

    /**
     * Get promotion by ID
     */
    getById = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const branchId = getBranchId(req as any);

        const promotion = await this.promotionsService.getById(id, branchId);

        if (!promotion) {
            throw AppError.notFound("Promotion not found");
        }

        return ApiResponses.ok(res, promotion);
    });

    /**
     * Create promotion
     */
    create = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);

        if (!req.body.promotion_code) {
            throw AppError.badRequest("Promotion code is required");
        }

        if (!req.body.name) {
            throw AppError.badRequest("Promotion name is required");
        }

        if (!req.body.promotion_type) {
            throw AppError.badRequest("Promotion type is required");
        }

        if (!req.body.condition_type) {
            throw AppError.badRequest("Condition type is required");
        }

        const promotion = await this.promotionsService.create(req.body, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PROMOTION_CREATE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Promotions",
            entity_id: (promotion as any)?.id,
            branch_id: branchId,
            new_values: req.body,
            path: req.originalUrl,
            method: req.method,
            description: `Create promotion ${(promotion as any)?.promotion_code || (promotion as any)?.id}`,
        });

        return ApiResponses.created(res, promotion);
    });

    /**
     * Update promotion
     */
    update = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const branchId = getBranchId(req as any);

        const oldPromotion = await this.promotionsService.getById(id, branchId);
        const promotion = await this.promotionsService.update(id, req.body, branchId);

        if (promotion) {
            const userInfo = getUserInfoFromRequest(req as any);
            await auditLogger.log({
                action_type: AuditActionType.PROMOTION_UPDATE,
                ...userInfo,
                ip_address: getClientIp(req),
                user_agent: req.get("User-Agent"),
                entity_type: "Promotions",
                entity_id: id,
                branch_id: branchId,
                old_values: oldPromotion as any,
                new_values: req.body,
                path: req.originalUrl,
                method: req.method,
                description: `Update promotion ${id}`,
            });
        }

        if (!promotion) {
            throw AppError.notFound("Promotion not found");
        }

        return ApiResponses.ok(res, promotion);
    });

    /**
     * Delete promotion
     */
    delete = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const branchId = getBranchId(req as any);

        const oldPromotion = await this.promotionsService.getById(id, branchId);
        await this.promotionsService.delete(id, branchId);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.PROMOTION_DELETE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Promotions",
            entity_id: id,
            branch_id: branchId,
            old_values: oldPromotion as any,
            path: req.originalUrl,
            method: req.method,
            description: `Delete promotion ${id}`,
        });

        return ApiResponses.ok(res, { message: "Promotion deleted successfully" });
    });
}
