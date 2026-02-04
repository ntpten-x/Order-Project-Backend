
import { Request, Response } from "express";
import { PaymentsService } from "../../services/pos/payments.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { ApiResponses } from "../../utils/ApiResponse";

export class PaymentsController {
    constructor(private paymentsService: PaymentsService) { }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const branchId = (req as any).user?.branch_id;
        const payments = await this.paymentsService.findAll(branchId);
        return ApiResponses.ok(res, payments);
    })

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = (req as any).user?.branch_id;
        const payment = await this.paymentsService.findOne(req.params.id, branchId)
        if (!payment) throw new AppError("ไม่พบข้อมูลการชำระเงิน", 404);
        return ApiResponses.ok(res, payment);
    })

    create = catchAsync(async (req: Request, res: Response) => {
        // Assume Auth Middleware has populated req.user
        const user = (req as any).user;
        if (!user || !user.id) {
            throw new AppError("Authentication required (User ID missing)", 401);
        }

        const branchId = user.branch_id;
        if (branchId) {
            // Always enforce branch isolation server-side
            req.body.branch_id = branchId;
        }

        const payment = await this.paymentsService.create(req.body, user.id, branchId)
        
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
        
        return ApiResponses.created(res, payment);
    })

    update = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const branchId = user?.branch_id;
        if (branchId) {
            // Prevent branch_id tampering
            req.body.branch_id = branchId;
        }

        const oldPayment = await this.paymentsService.findOne(req.params.id, branchId);
        const payment = await this.paymentsService.update(req.params.id, req.body, branchId)

        // Audit log - payment changes are critical
        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_UPDATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'Payments',
            entity_id: payment.id,
            branch_id: branchId,
            old_values: oldPayment ? { amount: oldPayment.amount, status: oldPayment.status, payment_method_id: oldPayment.payment_method_id } : undefined,
            new_values: { amount: payment.amount, status: payment.status, payment_method_id: payment.payment_method_id },
            description: `Updated payment ${payment.id} for order ${payment.order_id}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.ok(res, payment);
    })

    delete = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const branchId = user?.branch_id;
        const oldPayment = await this.paymentsService.findOne(req.params.id, branchId);

        await this.paymentsService.delete(req.params.id, branchId)

        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_DELETE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'Payments',
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldPayment ? { order_id: oldPayment.order_id, amount: oldPayment.amount, status: oldPayment.status } : undefined,
            description: oldPayment ? `Deleted payment ${req.params.id} for order ${oldPayment.order_id}` : `Deleted payment ${req.params.id}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.noContent(res);
    })
}
