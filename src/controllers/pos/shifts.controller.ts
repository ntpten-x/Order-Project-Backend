
import { Request, Response } from "express";
import { ShiftsService } from "../../services/pos/shifts.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";

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
        res.status(201).json(shift);
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
        res.status(200).json(shift);
    });

    getCurrentShift = catchAsync(async (req: Request, res: Response) => {
        // Get user_id from authenticated user
        const userId = (req as any).user?.id;

        if (!userId) {
            throw new AppError("Unauthorized - User not authenticated", 401);
        }

        const shift = await this.shiftsService.getCurrentShift(userId);
        res.status(200).json(shift);
    });

    getSummary = catchAsync(async (req: Request, res: Response) => {
        const { id } = req.params;
        const summary = await this.shiftsService.getShiftSummary(id);
        res.status(200).json(summary);
    });

    getCurrentSummary = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user?.id;
        if (!userId) throw new AppError("Unauthorized", 401);

        const currentShift = await this.shiftsService.getCurrentShift(userId);
        if (!currentShift) throw new AppError("No active shift found", 404);

        const summary = await this.shiftsService.getShiftSummary(currentShift.id);
        res.status(200).json(summary);
    });
}
