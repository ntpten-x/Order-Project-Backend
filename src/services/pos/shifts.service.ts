
import { AppDataSource } from "../../database/database";
import { Shifts, ShiftStatus } from "../../entity/pos/Shifts";
import { Payments } from "../../entity/pos/Payments";
import { AppError } from "../../utils/AppError";

export class ShiftsService {
    private shiftsRepo = AppDataSource.getRepository(Shifts);
    private paymentsRepo = AppDataSource.getRepository(Payments);

    async openShift(userId: string, startAmount: number): Promise<Shifts> {
        // Check if user already has an OPEN shift
        const activeShift = await this.shiftsRepo.findOne({
            where: {
                user_id: userId,
                status: ShiftStatus.OPEN
            }
        });

        if (activeShift) {
            throw new AppError("ผู้ใช้งานนี้มีกะที่เปิดอยู่แล้ว กรุณาปิดกะก่อนเปิดใหม่", 400);
        }

        const newShift = new Shifts();
        newShift.user_id = userId;
        newShift.start_amount = startAmount;
        newShift.status = ShiftStatus.OPEN;
        newShift.open_time = new Date();

        return await this.shiftsRepo.save(newShift);
    }

    async getCurrentShift(userId: string): Promise<Shifts | null> {
        return await this.shiftsRepo.findOne({
            where: {
                user_id: userId,
                status: ShiftStatus.OPEN
            }
        });
    }

    async closeShift(userId: string, endAmount: number): Promise<Shifts> {
        const activeShift = await this.getCurrentShift(userId);
        if (!activeShift) {
            throw new AppError("ไม่พบกะที่กำลังทำงานอยู่", 404);
        }

        // Calculate Total Sales during this shift
        // Sum of all payments linked to this shift
        const payments = await this.paymentsRepo.find({
            where: { shift_id: activeShift.id }
        });

        const totalSales = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        // Expected Amount = Start + Sales
        // Note: In real world, we might subtract payouts/expenses. For now simple logic.
        const expectedAmount = Number(activeShift.start_amount) + totalSales;

        activeShift.end_amount = endAmount;
        activeShift.expected_amount = expectedAmount;
        activeShift.diff_amount = Number(endAmount) - expectedAmount;
        activeShift.status = ShiftStatus.CLOSED;
        activeShift.close_time = new Date();

        return await this.shiftsRepo.save(activeShift);
    }
}
