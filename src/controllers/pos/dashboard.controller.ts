import { Request, Response } from "express";
import { DashboardService } from "../../services/pos/dashboard.service";
import { catchAsync } from "../../utils/catchAsync";
import { getBranchId } from "../../middleware/branch.middleware";
import { ApiResponses } from "../../utils/ApiResponse";

export class DashboardController {
    constructor(private dashboardService: DashboardService) { }
    private readonly responseMaxAgeSec = Number(process.env.DASHBOARD_RESPONSE_CACHE_MAX_AGE_SEC || 15);
    private readonly responseStaleSec = Number(process.env.DASHBOARD_RESPONSE_CACHE_STALE_SEC || 30);
    private readonly responseCachePublic = process.env.DASHBOARD_RESPONSE_CACHE_PUBLIC === "true";

    private setCacheHeaders(res: Response): void {
        const visibility = this.responseCachePublic ? "public" : "private";
        res.setHeader(
            "Cache-Control",
            `${visibility}, max-age=0, s-maxage=${this.responseMaxAgeSec}, stale-while-revalidate=${this.responseStaleSec}`
        );
        res.setHeader("Vary", "Authorization, Cookie");
    }

    getSalesSummary = catchAsync(async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getSalesSummary(
            startDate as string,
            endDate as string,
            branchId
        );
        this.setCacheHeaders(res);
        return ApiResponses.ok(res, result);
    });

    getOverview = catchAsync(async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query;
        const topLimit = parseInt(req.query.topLimit as string, 10) || 7;
        const recentLimit = parseInt(req.query.recentLimit as string, 10) || 8;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getOverview(
            startDate as string | undefined,
            endDate as string | undefined,
            branchId,
            topLimit,
            recentLimit
        );
        this.setCacheHeaders(res);
        return ApiResponses.ok(res, result);
    });

    getTopSellingItems = catchAsync(async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 10;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getTopSellingItems(limit, branchId);
        this.setCacheHeaders(res);
        return ApiResponses.ok(res, result);
    });
}
