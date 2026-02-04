import { Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { ApiResponses } from "../../utils/ApiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";

/**
 * Promotions feature has been removed in favor of Discounts.
 * This controller remains as a stub to keep TypeScript builds stable.
 */
export class PromotionsController {
    private readonly removedMessage = "Promotions feature has been removed. Please use discounts instead.";

    validatePromotion = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.badRequest(res, this.removedMessage);
    });

    applyPromotion = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.badRequest(res, this.removedMessage);
    });

    getActivePromotions = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.ok(res, []);
    });

    getAll = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.ok(res, []);
    });

    getById = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.notFound(res, "Promotion");
    });

    create = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.badRequest(res, this.removedMessage);
    });

    update = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.badRequest(res, this.removedMessage);
    });

    delete = catchAsync(async (_req: AuthRequest, res: Response) => {
        return ApiResponses.badRequest(res, this.removedMessage);
    });
}
