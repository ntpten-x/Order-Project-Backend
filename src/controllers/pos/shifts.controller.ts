import { Request, Response } from "express";
import { ShiftsService } from "../../services/pos/shifts.service";
import { ShiftStatus } from "../../entity/pos/Shifts";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { ApiResponses } from "../../utils/ApiResponse";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";
import { parseCreatedSort } from "../../utils/sortCreated";
import { resolvePermissionForRequest } from "../../middleware/permission.middleware";
import type { AuthRequest } from "../../middleware/auth.middleware";

export class ShiftsController {
    constructor(private shiftsService: ShiftsService) { }

    private isShiftOwnedByActor(currentShift: Awaited<ReturnType<ShiftsService["getCurrentShift"]>>, actorUserId?: string | null): boolean {
        if (!currentShift || !actorUserId) return false;
        return currentShift.opened_by_user_id
            ? currentShift.opened_by_user_id === actorUserId
            : currentShift.user_id === actorUserId;
    }

    private sanitizeCurrentShiftFinancials<
        T extends {
            start_amount?: number | string | null;
            end_amount?: number | string | null;
            expected_amount?: number | string | null;
            diff_amount?: number | string | null;
        },
    >(shift: T, canViewFinancials: boolean): T {
        if (canViewFinancials) {
            return shift;
        }

        return {
            ...shift,
            start_amount: 0,
            end_amount: null,
            expected_amount: null,
            diff_amount: null,
        };
    }

    private async sanitizeHistoryResponse(
        req: AuthRequest,
        result: Awaited<ReturnType<ShiftsService["getShiftHistory"]>>
    ) {
        const [canViewStats, canViewFinancials] = await Promise.all([
            resolvePermissionForRequest(req, "shift_history.stats.feature", "view"),
            resolvePermissionForRequest(req, "shift_history.financials.feature", "view"),
        ]);

        return {
            ...result,
            data: result.data.map((shift) =>
                canViewFinancials
                    ? shift
                    : {
                        ...shift,
                        start_amount: 0,
                        end_amount: null,
                        expected_amount: null,
                        diff_amount: null,
                    }
            ),
            stats: canViewStats
                ? result.stats
                : {
                    total: 0,
                    open: 0,
                    closed: 0,
                    total_start_amount: 0,
                    total_end_amount: 0,
                    total_expected_amount: 0,
                    total_diff_amount: 0,
                },
        };
    }

    private async assertCanCloseShift(req: Request, branchId: string, userId: string): Promise<void> {
        const userRole = (req as any).user?.roles?.roles_name;
        const currentShift = await this.shiftsService.getCurrentShift(branchId);
        if (!currentShift) {
            throw new AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
        }

        const canCloseByRole = userRole === "Admin" || userRole === "Manager";
        const isShiftOpener = currentShift.opened_by_user_id
            ? currentShift.opened_by_user_id === userId
            : currentShift.user_id === userId;

        if (!canCloseByRole && !isShiftOpener) {
            throw new AppError("Access denied: only Admin/Manager or shift opener can close shift", 403);
        }
    }

    openShift = catchAsync(async (req: Request, res: Response) => {
        const user_id = (req as any).user?.id;
        const branch_id = getBranchId(req as any);
        const { start_amount } = req.body;

        if (!user_id) {
            throw new AppError("Unauthorized - User not authenticated", 401);
        }

        if (start_amount === undefined || start_amount === null) {
            throw new AppError("กรุณาระบุจำนวนเงินทอนเริ่มต้น", 400);
        }

        const shift = await this.shiftsService.openShift(user_id, Number(start_amount), branch_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.SHIFT_OPEN,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Shifts",
            entity_id: shift.id,
            branch_id,
            new_values: { start_amount: Number(start_amount) },
            path: req.originalUrl,
            method: req.method,
            description: `Open shift ${shift.id}`,
        });
        return ApiResponses.created(res, shift);
    });

    previewCloseShift = catchAsync(async (req: Request, res: Response) => {
        const user_id = (req as any).user?.id;
        const branchId = getBranchId(req as any);
        const { end_amount } = req.body;

        if (!user_id) {
            throw new AppError("Unauthorized - User not authenticated", 401);
        }
        if (!branchId) {
            throw new AppError("Branch context is required", 400);
        }
        if (end_amount === undefined || end_amount === null) {
            throw new AppError("กรุณาระบุจำนวนเงินที่นับได้", 400);
        }

        await this.assertCanCloseShift(req, branchId, user_id);
        const preview = await this.shiftsService.previewCloseShift(branchId, Number(end_amount));

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.SHIFT_CLOSE_PREVIEW,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Shifts",
            entity_id: preview.shiftId,
            branch_id: branchId,
            new_values: {
                end_amount: preview.endAmount,
                expected_amount: preview.expectedAmount,
                diff_amount: preview.diffAmount,
                variance_status: preview.varianceStatus,
                start_amount: preview.startAmount,
                cash_sales: preview.cashSales,
            },
            path: req.originalUrl,
            method: req.method,
            description: `Preview close shift ${preview.shiftId} (${preview.varianceStatus})`,
        });

        return ApiResponses.ok(res, preview);
    });

    closeShift = catchAsync(async (req: Request, res: Response) => {
        const user_id = (req as any).user?.id;
        const branchId = getBranchId(req as any);
        const { end_amount } = req.body;

        if (!user_id) {
            throw new AppError("Unauthorized - User not authenticated", 401);
        }
        if (!branchId) {
            throw new AppError("Branch context is required", 400);
        }

        if (end_amount === undefined || end_amount === null) {
            throw new AppError("กรุณาระบุจำนวนเงินที่นับได้", 400);
        }

        await this.assertCanCloseShift(req, branchId, user_id);
        const shift = await this.shiftsService.closeShift(branchId, Number(end_amount), user_id);

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.SHIFT_CLOSE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get("User-Agent"),
            entity_type: "Shifts",
            entity_id: shift.id,
            branch_id: branchId,
            new_values: { end_amount: Number(end_amount) },
            path: req.originalUrl,
            method: req.method,
            description: `Close shift ${shift.id}`,
        });
        return ApiResponses.ok(res, shift);
    });

    getCurrentShift = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const shift = await this.shiftsService.getCurrentShift(branchId);
        if (!shift) {
            return ApiResponses.ok(res, shift);
        }

        const actorUserId = (req as AuthRequest).user?.id;
        const financialPermission = await resolvePermissionForRequest(
            req as AuthRequest,
            "shifts.financials.feature",
            "view"
        );
        const canViewFinancials = Boolean(
            financialPermission &&
            (financialPermission.scope !== "own" || this.isShiftOwnedByActor(shift, actorUserId))
        );

        return ApiResponses.ok(res, this.sanitizeCurrentShiftFinancials(shift, canViewFinancials));
    });

    getSummary = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const branchId = getBranchId(req as any);
        const actorUserId = (req as AuthRequest).user?.id;
        const permission = (req as AuthRequest).permission;

        if (permission?.scope === "own") {
            if (!actorUserId) {
                throw new AppError("Unauthorized - User not authenticated", 401);
            }

            const canAccessOwnShift = await this.shiftsService.canUserAccessShiftHistory(
                id,
                branchId,
                actorUserId
            );
            if (!canAccessOwnShift) {
                throw new AppError("Access denied: Own scope only", 403);
            }
        }

        const summary = await this.shiftsService.getShiftSummary(id, branchId);
        return ApiResponses.ok(res, summary);
    });

    getCurrentSummary = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const currentShift = await this.shiftsService.getCurrentShift(branchId);
        if (!currentShift) throw new AppError("No active shift found", 404);

        const summary = await this.shiftsService.getShiftSummary(currentShift.id, branchId);
        const actorUserId = (req as AuthRequest).user?.id;
        const [financialPermission, channelsPermission, topProductsPermission] = await Promise.all([
            resolvePermissionForRequest(req as AuthRequest, "shifts.financials.feature", "view"),
            resolvePermissionForRequest(req as AuthRequest, "shifts.channels.feature", "view"),
            resolvePermissionForRequest(req as AuthRequest, "shifts.top_products.feature", "view"),
        ]);

        const ownsCurrentShift = this.isShiftOwnedByActor(currentShift, actorUserId);
        const canViewFinancials = Boolean(
            financialPermission &&
            (financialPermission.scope !== "own" || ownsCurrentShift)
        );
        const canViewChannels = Boolean(channelsPermission);
        const canViewTopProducts = Boolean(topProductsPermission);

        return ApiResponses.ok(res, {
            ...summary,
            shift_info: this.sanitizeCurrentShiftFinancials(summary.shift_info, canViewFinancials),
            summary: {
                ...summary.summary,
                payment_methods: canViewFinancials ? summary.summary.payment_methods : {},
                order_types: canViewChannels ? summary.summary.order_types : {},
            },
            top_products: canViewTopProducts ? summary.top_products : [],
        });
    });

    getHistory = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) {
            throw new AppError("Branch context is required", 400);
        }

        const actorUserId = (req as AuthRequest).user?.id;
        const pagePermission = await resolvePermissionForRequest(
            req as AuthRequest,
            "shift_history.page",
            "view"
        );
        if (!pagePermission) {
            throw new AppError("Access denied: shift history permission required", 403);
        }

        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const rawLimit = parseInt(req.query.limit as string);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 20;
        const q = (req.query.q as string | undefined) || undefined;

        const rawStatus = (req.query.status as string | undefined)?.toUpperCase();
        let status: ShiftStatus | undefined;
        if (rawStatus) {
            if (rawStatus !== ShiftStatus.OPEN && rawStatus !== ShiftStatus.CLOSED) {
                throw new AppError("Invalid shift status filter", 400);
            }
            status = rawStatus as ShiftStatus;
        }

        const dateFromRaw = req.query.date_from as string | undefined;
        const dateToRaw = req.query.date_to as string | undefined;
        const sortCreated = parseCreatedSort(req.query.sort_created);

        const dateFrom = dateFromRaw ? new Date(dateFromRaw) : undefined;
        const dateTo = dateToRaw ? new Date(dateToRaw) : undefined;

        if (dateFromRaw && Number.isNaN(dateFrom?.getTime())) {
            throw new AppError("Invalid date_from", 400);
        }
        if (dateToRaw && Number.isNaN(dateTo?.getTime())) {
            throw new AppError("Invalid date_to", 400);
        }

        const result = await this.shiftsService.getShiftHistory({
            branchId,
            page,
            limit,
            q,
            status,
            dateFrom,
            dateTo,
            sortCreated,
            actorUserId: pagePermission.scope === "own" ? actorUserId : undefined,
        });

        const sanitized = await this.sanitizeHistoryResponse(req as AuthRequest, result);
        return ApiResponses.ok(res, sanitized);
    });
}
