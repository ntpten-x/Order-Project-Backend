import { Request, Response } from "express";
import { PromotionsService } from "../../services/pos/promotions.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";

export class PromotionsController {
    private promotionsService = new PromotionsService();

    /**
     * Validate promotion code
     */
    validatePromotion = catchAsync(async (req: AuthRequest, res: Response) => {
        const { code, orderItems, totalAmount } = req.body;
        const branchId = req.user?.branch_id;

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
        const branchId = req.user?.branch_id;

        if (!code) {
            throw AppError.badRequest("Promotion code is required");
        }

        const promotion = await this.promotionsService.applyPromotion(code, branchId);

        return ApiResponses.ok(res, promotion);
    });

    /**
     * Get active promotions
     */
    getActivePromotions = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = req.user?.branch_id;

        const promotions = await this.promotionsService.getActivePromotions(branchId);

        return ApiResponses.ok(res, promotions);
    });

    /**
     * Get all promotions
     */
    getAll = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = req.user?.branch_id;
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

        const promotions = await this.promotionsService.getAll(branchId, isActive);

        return ApiResponses.ok(res, promotions);
    });

    /**
     * Get promotion by ID
     */
    getById = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const branchId = req.user?.branch_id;

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
        const branchId = req.user?.branch_id;

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

        return ApiResponses.created(res, promotion);
    });

    /**
     * Update promotion
     */
    update = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const branchId = req.user?.branch_id;

        const promotion = await this.promotionsService.update(id, req.body, branchId);

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
        const branchId = req.user?.branch_id;

        await this.promotionsService.delete(id, branchId);

        return ApiResponses.ok(res, { message: "Promotion deleted successfully" });
    });
}
