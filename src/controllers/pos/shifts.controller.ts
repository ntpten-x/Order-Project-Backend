
import { Request, Response } from "express";
import { ShiftsService } from "../../services/pos/shifts.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";

export class ShiftsController {
    constructor(private shiftsService: ShiftsService) { }

    openShift = catchAsync(async (req: Request, res: Response) => {
        const { user_id, start_amount } = req.body;

        if (!user_id || start_amount === undefined) {
            throw new AppError("Invalid input", 400);
        }

        const shift = await this.shiftsService.openShift(user_id, start_amount);
        res.status(201).json(shift);
    });

    closeShift = catchAsync(async (req: Request, res: Response) => {
        const { user_id, end_amount } = req.body;

        if (!user_id || end_amount === undefined) {
            throw new AppError("Invalid input", 400);
        }

        const shift = await this.shiftsService.closeShift(user_id, end_amount);
        res.status(200).json(shift);
    });

    getCurrentShift = catchAsync(async (req: Request, res: Response) => {
        const userId = req.query.user_id as string;
        if (!userId) {
            throw new AppError("User ID required", 400);
        }

        const shift = await this.shiftsService.getCurrentShift(userId);
        res.status(200).json(shift);
    });
}
