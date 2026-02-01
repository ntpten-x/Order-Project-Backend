
import { Request, Response } from "express";
import { PaymentsService } from "../../services/pos/payments.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";

export class PaymentsController {
    constructor(private paymentsService: PaymentsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const payments = await this.paymentsService.findAll()
        res.status(200).json(payments)
    })

    findOne = catchAsync(async (req: Request, res: Response) => {
        const payment = await this.paymentsService.findOne(req.params.id)
        if (!payment) throw new AppError("ไม่พบข้อมูลการชำระเงิน", 404);
        res.status(200).json(payment)
    })

    create = catchAsync(async (req: Request, res: Response) => {
        // Assume Auth Middleware has populated req.user
        const user = (req as any).user;
        if (!user || !user.id) {
            throw new AppError("Authentication required (User ID missing)", 401);
        }

        const payment = await this.paymentsService.create(req.body, user.id)
        
        // Audit log - CRITICAL for payment tracking
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_CREATE,
            user_id: user.id,
            username: user.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'Payments',
            entity_id: payment.id,
            branch_id: user.branch_id,
            new_values: { 
                order_id: payment.order_id, 
                amount: payment.amount, 
                payment_method_id: payment.payment_method_id,
                status: payment.status 
            },
            description: `Created payment for order ${payment.order_id} - Amount: ${payment.amount}`,
            path: req.path,
            method: req.method,
        });
        
        res.status(201).json(payment)
    })

    update = catchAsync(async (req: Request, res: Response) => {
        const payment = await this.paymentsService.update(req.params.id, req.body)
        res.status(200).json(payment)
    })

    delete = catchAsync(async (req: Request, res: Response) => {
        await this.paymentsService.delete(req.params.id)
        res.status(200).json({ message: "ลบข้อมูลการชำระเงินสำเร็จ" })
    })
}
