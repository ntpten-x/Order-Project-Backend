import { Request, Response } from "express";
import { DashboardService } from "../../services/pos/dashboard.service";
import { catchAsync } from "../../utils/catchAsync";
import { getBranchId } from "../../middleware/branch.middleware";
import { ApiResponses } from "../../utils/ApiResponse";

export class DashboardController {
    constructor(private dashboardService: DashboardService) { }

    getSalesSummary = catchAsync(async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getSalesSummary(
            startDate as string,
            endDate as string,
            branchId
        );
        return ApiResponses.ok(res, result);
    });

    getTopSellingItems = catchAsync(async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 10;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getTopSellingItems(limit, branchId);
        return ApiResponses.ok(res, result);
    });
}
