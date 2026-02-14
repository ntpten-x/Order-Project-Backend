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

export class ShiftsController {
    constructor(private shiftsService: ShiftsService) { }

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

    closeShift = catchAsync(async (req: Request, res: Response) => {
        const user_id = (req as any).user?.id;
        const userRole = (req as any).user?.roles?.roles_name;
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

        const currentShift = await this.shiftsService.getCurrentShift(branchId);
        if (!currentShift) {
            throw new AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
        }

        const canCloseByRole = userRole === "Admin" || userRole === "Manager";
        const isShiftOpener = currentShift.opened_by_user_id
            ? currentShift.opened_by_user_id === user_id
            : currentShift.user_id === user_id;

        if (!canCloseByRole && !isShiftOpener) {
            throw new AppError("Access denied: only Admin/Manager or shift opener can close shift", 403);
        }

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
        return ApiResponses.ok(res, shift);
    });

    getSummary = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const branchId = getBranchId(req as any);
        const summary = await this.shiftsService.getShiftSummary(id, branchId);
        return ApiResponses.ok(res, summary);
    });

    getCurrentSummary = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const currentShift = await this.shiftsService.getCurrentShift(branchId);
        if (!currentShift) throw new AppError("No active shift found", 404);

        const summary = await this.shiftsService.getShiftSummary(currentShift.id, branchId);
        return ApiResponses.ok(res, summary);
    });

    getHistory = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        if (!branchId) {
            throw new AppError("Branch context is required", 400);
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
            sortCreated
        });

        return ApiResponses.ok(res, result);
    });
}
