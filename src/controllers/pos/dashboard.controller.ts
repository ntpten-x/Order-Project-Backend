import { Request, Response } from "express";
import { DashboardService } from "../../services/pos/dashboard.service";
import { OrdersService } from "../../services/pos/orders.service";
import { catchAsync } from "../../utils/catchAsync";
import { getBranchId } from "../../middleware/branch.middleware";
import { ApiResponses } from "../../utils/ApiResponse";
import { AppError } from "../../utils/AppError";
import { resolvePermissionForRequest } from "../../middleware/permission.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";

type DashboardOverviewResponse = {
    summary: {
        period_start: string | null;
        period_end: string | null;
        total_sales: number;
        total_orders: number;
        total_discount: number;
        average_order_value: number;
        cash_sales: number;
        qr_sales: number;
        dine_in_sales: number;
        takeaway_sales: number;
        delivery_sales: number;
    };
    daily_sales: unknown[];
    top_items: unknown[];
    recent_orders: unknown[];
};

export class DashboardController {
    constructor(
        private dashboardService: DashboardService,
        private ordersService: OrdersService,
    ) { }
    private readonly responseMaxAgeSec = Number(process.env.DASHBOARD_RESPONSE_CACHE_MAX_AGE_SEC || 15);
    private readonly responseStaleSec = Number(process.env.DASHBOARD_RESPONSE_CACHE_STALE_SEC || 30);
    private readonly responseCachePublic = process.env.DASHBOARD_RESPONSE_CACHE_PUBLIC === "true";

    private requestUsesAdvancedFilters(req: Request): boolean {
        return Boolean(req.query.startAt || req.query.endAt);
    }

    private async assertAdvancedFiltersPermission(req: AuthRequest): Promise<void> {
        if (!this.requestUsesAdvancedFilters(req)) {
            return;
        }

        const permission = await resolvePermissionForRequest(req, "reports.sales.filters.feature", "view");
        if (!permission) {
            throw new AppError("Advanced dashboard filters require additional permission", 403);
        }
    }

    private async sanitizeOverviewByPermission(req: AuthRequest, result: DashboardOverviewResponse): Promise<DashboardOverviewResponse> {
        const [canViewSummary, canViewChannels, canViewTopItems, canViewRecentOrders] = await Promise.all([
            resolvePermissionForRequest(req, "reports.sales.summary.feature", "view"),
            resolvePermissionForRequest(req, "reports.sales.channels.feature", "view"),
            resolvePermissionForRequest(req, "reports.sales.top_items.feature", "view"),
            resolvePermissionForRequest(req, "reports.sales.recent_orders.feature", "view"),
        ]);

        const sanitizedSummary = {
            ...result.summary,
            cash_sales: canViewChannels ? Number(result.summary.cash_sales || 0) : 0,
            qr_sales: canViewChannels ? Number(result.summary.qr_sales || 0) : 0,
            dine_in_sales: canViewChannels ? Number(result.summary.dine_in_sales || 0) : 0,
            takeaway_sales: canViewChannels ? Number(result.summary.takeaway_sales || 0) : 0,
            delivery_sales: canViewChannels ? Number(result.summary.delivery_sales || 0) : 0,
        };

        return {
            summary: canViewSummary
                ? sanitizedSummary
                : {
                    ...sanitizedSummary,
                    total_sales: 0,
                    total_orders: 0,
                    total_discount: 0,
                    average_order_value: 0,
                },
            daily_sales: canViewSummary ? result.daily_sales : [],
            top_items: canViewTopItems ? result.top_items : [],
            recent_orders: canViewRecentOrders ? result.recent_orders : [],
        };
    }

    private setCacheHeaders(res: Response): void {
        const visibility = this.responseCachePublic ? "public" : "private";
        res.setHeader(
            "Cache-Control",
            `${visibility}, max-age=0, s-maxage=${this.responseMaxAgeSec}, stale-while-revalidate=${this.responseStaleSec}`
        );
        res.setHeader("Vary", "Authorization, Cookie");
    }

    getSalesSummary = catchAsync(async (req: Request, res: Response) => {
        await this.assertAdvancedFiltersPermission(req as AuthRequest);
        const { startDate, endDate, startAt, endAt } = req.query;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getSalesSummary(
            startDate as string,
            endDate as string,
            branchId,
            startAt as string | undefined,
            endAt as string | undefined,
        );
        this.setCacheHeaders(res);
        return ApiResponses.ok(res, result);
    });

    getOverview = catchAsync(async (req: Request, res: Response) => {
        await this.assertAdvancedFiltersPermission(req as AuthRequest);
        const { startDate, endDate, startAt, endAt } = req.query;
        const topLimit = parseInt(req.query.topLimit as string, 10) || 7;
        const recentLimit = parseInt(req.query.recentLimit as string, 10) || 8;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getOverview(
            startDate as string | undefined,
            endDate as string | undefined,
            branchId,
            topLimit,
            recentLimit,
            startAt as string | undefined,
            endAt as string | undefined,
        );
        const sanitized = await this.sanitizeOverviewByPermission(req as AuthRequest, result as DashboardOverviewResponse);
        this.setCacheHeaders(res);
        return ApiResponses.ok(res, sanitized);
    });

    getTopSellingItems = catchAsync(async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 10;
        const branchId = getBranchId(req as any);
        const result = await this.dashboardService.getTopSellingItems(limit, branchId);
        this.setCacheHeaders(res);
        return ApiResponses.ok(res, result);
    });

    getOrderDetail = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const orderId = req.params.id;
        const permission = (req as any).permission;

        const result = await this.ordersService.findOne(orderId, branchId, {
            scope: permission?.scope,
            actorUserId: (req as any).user?.id,
        });

        if (!result) {
            throw new AppError("Order not found", 404);
        }

        this.setCacheHeaders(res);
        return ApiResponses.ok(res, result);
    });
}
