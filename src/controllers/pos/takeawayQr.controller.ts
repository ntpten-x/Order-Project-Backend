import { Response } from "express";
import { getBranchId } from "../../middleware/branch.middleware";
import { AuthRequest } from "../../middleware/auth.middleware";
import { TakeawayQrService } from "../../services/pos/takeawayQr.service";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";

export class TakeawayQrController {
    constructor(private takeawayQrService: TakeawayQrService) { }

    getInfo = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) {
            throw new AppError("Branch ID is required", 400);
        }
        const data = await this.takeawayQrService.getQrInfo(branchId);
        return ApiResponses.ok(res, data);
    });

    rotateQr = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) {
            throw new AppError("Branch ID is required", 400);
        }
        const data = await this.takeawayQrService.rotateQr(branchId);
        return ApiResponses.ok(res, data);
    });
}
