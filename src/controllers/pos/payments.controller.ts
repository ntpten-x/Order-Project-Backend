import { Request, Response } from "express";

import { PaymentsService } from "../../services/pos/payments.service";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { auditLogger, AuditActionType } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { ApiResponses } from "../../utils/ApiResponse";
import { getBranchId } from "../../middleware/branch.middleware";

export class PaymentsController {
    constructor(private paymentsService: PaymentsService) { }

    private getAccess(req: Request) {
        const scope = (req as any).permission?.scope;
        const actorUserId = (req as any).user?.id;
        if (scope === "own" && !actorUserId) {
            return { scope: "none" as const };
        }
        return {
            scope,
            actorUserId,
        };
    }

    findAll = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const payments = await this.paymentsService.findAll(branchId, this.getAccess(req));
        return ApiResponses.ok(res, payments);
    });

    findOne = catchAsync(async (req: Request, res: Response) => {
        const branchId = getBranchId(req as any);
        const payment = await this.paymentsService.findOne(req.params.id, branchId, this.getAccess(req));
        if (!payment) {
            throw new AppError("Payment not found", 404);
        }
        return ApiResponses.ok(res, payment);
    });

    create = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        if (!user?.id) {
            throw new AppError("Authentication required (User ID missing)", 401);
        }

        const branchId = getBranchId(req as any);
        if (branchId) {
            req.body.branch_id = branchId;
        }

        const payment = await this.paymentsService.create(req.body, user.id, branchId, this.getAccess(req));

        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_CREATE,
            user_id: user.id,
            username: user.username,
            ip_address: getClientIp(req),
            user_agent: req.headers["user-agent"],
            entity_type: "Payments",
            entity_id: payment.id,
            branch_id: branchId,
            new_values: {
                order_id: payment.order_id,
                amount: payment.amount,
                payment_method_id: payment.payment_method_id,
                status: payment.status,
            },
            description: `Created payment for order ${payment.order_id} - Amount: ${payment.amount}`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.created(res, payment);
    });

    update = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        const access = this.getAccess(req);

        if (branchId) {
            req.body.branch_id = branchId;
        }

        const oldPayment = await this.paymentsService.findOne(req.params.id, branchId, access);
        const payment = await this.paymentsService.update(req.params.id, req.body, branchId, access);

        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_UPDATE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers["user-agent"],
            entity_type: "Payments",
            entity_id: payment.id,
            branch_id: branchId,
            old_values: oldPayment
                ? {
                    amount: oldPayment.amount,
                    status: oldPayment.status,
                    payment_method_id: oldPayment.payment_method_id,
                }
                : undefined,
            new_values: {
                amount: payment.amount,
                status: payment.status,
                payment_method_id: payment.payment_method_id,
            },
            description: `Updated payment ${payment.id} for order ${payment.order_id}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.ok(res, payment);
    });

    delete = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const branchId = getBranchId(req as any);
        const access = this.getAccess(req);
        const oldPayment = await this.paymentsService.findOne(req.params.id, branchId, access);

        await this.paymentsService.delete(req.params.id, branchId, access);

        await auditLogger.log({
            action_type: AuditActionType.PAYMENT_DELETE,
            user_id: user?.id,
            username: user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers["user-agent"],
            entity_type: "Payments",
            entity_id: req.params.id,
            branch_id: branchId,
            old_values: oldPayment
                ? { order_id: oldPayment.order_id, amount: oldPayment.amount, status: oldPayment.status }
                : undefined,
            description: oldPayment
                ? `Deleted payment ${req.params.id} for order ${oldPayment.order_id}`
                : `Deleted payment ${req.params.id}`,
            path: req.path,
            method: req.method,
        });
        return ApiResponses.noContent(res);
    });
}
