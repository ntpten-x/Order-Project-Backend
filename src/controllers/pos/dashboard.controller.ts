import { Request, Response } from "express";
import { DashboardService } from "../../services/pos/dashboard.service";
import { catchAsync } from "../../utils/catchAsync";

export class DashboardController {
    constructor(private dashboardService: DashboardService) { }

    getSalesSummary = catchAsync(async (req: Request, res: Response) => {
        const { startDate, endDate } = req.query;
        const result = await this.dashboardService.getSalesSummary(
            startDate as string,
            endDate as string
        );
        res.status(200).json(result);
    });

    getTopSellingItems = catchAsync(async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 10;
        const result = await this.dashboardService.getTopSellingItems(limit);
        res.status(200).json(result);
    });
}
