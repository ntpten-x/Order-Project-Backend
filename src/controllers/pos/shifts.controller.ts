
import { Request, Response } from "express";
import { ShiftsService } from "../../services/pos/shifts.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType, getUserInfoFromRequest } from "../../utils/auditLogger";
import { ApiResponses } from "../../utils/ApiResponse";
import { getClientIp } from "../../utils/securityLogger";

export class ShiftsController {
    constructor(private shiftsService: ShiftsService) { }

    openShift = catchAsync(async (req: Request, res: Response) => {
        // Get user_id from authenticated user
        const user_id = (req as any).user?.id;
        const branch_id = (req as any).user?.branch_id;
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
            user_agent: req.get('User-Agent'),
            entity_type: 'Shifts',
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
        // Get user_id from authenticated user
        const user_id = (req as any).user?.id;
        const { end_amount } = req.body;

        if (!user_id) {
            throw new AppError("Unauthorized - User not authenticated", 401);
        }

        if (end_amount === undefined || end_amount === null) {
            throw new AppError("กรุณาระบุจำนวนเงินที่นับได้", 400);
        }

        const shift = await this.shiftsService.closeShift(user_id, Number(end_amount));

        const userInfo = getUserInfoFromRequest(req as any);
        await auditLogger.log({
            action_type: AuditActionType.SHIFT_CLOSE,
            ...userInfo,
            ip_address: getClientIp(req),
            user_agent: req.get('User-Agent'),
            entity_type: 'Shifts',
            entity_id: shift.id,
            branch_id: (req as any).user?.branch_id,
            new_values: { end_amount: Number(end_amount) },
            path: req.originalUrl,
            method: req.method,
            description: `Close shift ${shift.id}`,
        });
        return ApiResponses.ok(res, shift);
    });

    getCurrentShift = catchAsync(async (req: Request, res: Response) => {
        // Get user_id from authenticated user
        const userId = (req as any).user?.id;

        if (!userId) {
            throw new AppError("Unauthorized - User not authenticated", 401);
        }

        const shift = await this.shiftsService.getCurrentShift(userId);
        return ApiResponses.ok(res, shift);
    });

    getSummary = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const branchId = (req as any).user?.branch_id;
        const summary = await this.shiftsService.getShiftSummary(id, branchId);
        return ApiResponses.ok(res, summary);
    });

    getCurrentSummary = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user?.id;
        if (!userId) throw new AppError("Unauthorized", 401);

        const currentShift = await this.shiftsService.getCurrentShift(userId);
        if (!currentShift) throw new AppError("No active shift found", 404);

        const branchId = (req as any).user?.branch_id;
        const summary = await this.shiftsService.getShiftSummary(currentShift.id, branchId);
        return ApiResponses.ok(res, summary);
    });
}
