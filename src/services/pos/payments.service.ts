import { EntityManager } from "typeorm";

import { PaymentsModels } from "../../models/pos/payments.model";
import { Payments, PaymentStatus } from "../../entity/pos/Payments";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { getDbManager, runInTransaction } from "../../database/dbContext";
import { AppError } from "../../utils/AppError";
import { invalidateCache } from "../../utils/cache";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { isCancelledStatus } from "../../utils/orderStatus";
import { ShiftsService } from "./shifts.service";
import { SocketService } from "../socket.service";
import { getTableCacheInvalidationPatterns } from "./tableCache.utils";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class PaymentsService {
    private socketService = SocketService.getInstance();
    private shiftsService = new ShiftsService();

    constructor(private paymentsModel: PaymentsModels) { }

    async findAll(branchId?: string, access?: AccessContext): Promise<Payments[]> {
        return this.paymentsModel.findAll(branchId, access);
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<Payments | null> {
        return this.paymentsModel.findOne(id, branchId, access);
    }

    private invalidateTableCache(branchId?: string, tableId?: string): void {
        invalidateCache(getTableCacheInvalidationPatterns(branchId, tableId));
    }

    private async findAccessiblePayment(
        id: string,
        manager: EntityManager,
        branchId?: string,
        access?: AccessContext,
    ): Promise<Payments | null> {
        const qb = manager.getRepository(Payments)
            .createQueryBuilder("payments")
            .leftJoinAndSelect("payments.order", "order")
            .leftJoinAndSelect("payments.payment_method", "payment_method")
            .where("payments.id = :id", { id });

        if (branchId) {
            qb.andWhere("payments.branch_id = :branchId", { branchId });
        }

        if (access?.scope === "none") {
            qb.andWhere("1=0");
        }

        if (access?.scope === "own") {
            if (!access.actorUserId) {
                qb.andWhere("1=0");
            } else {
                qb.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
            }
        }

        return qb.getOne();
    }

    private async refreshOrderPaymentSummary(
        orderId: string,
        manager: EntityManager = getDbManager(),
        branchId?: string
    ): Promise<void> {
        const orderRepo = manager.getRepository(SalesOrder);
        const paymentsRepo = manager.getRepository(Payments);
        const tablesRepo = manager.getRepository(Tables);

        const order = await orderRepo.findOne({
            where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId },
        });
        if (!order) return;

        const payments = await paymentsRepo.find({
            where: { order_id: orderId, status: PaymentStatus.Success },
        });

        const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const totalReceived = payments.reduce((sum, payment) => sum + Number(payment.amount_received || 0), 0);
        const totalChange = payments.reduce((sum, payment) => sum + Number(payment.change_amount || 0), 0);

        const nextStatus =
            isCancelledStatus(order.status)
                ? OrderStatus.Cancelled
                : totalPaid >= Number(order.total_amount)
                    ? OrderStatus.Completed
                    : order.status;

        await orderRepo.update(orderId, {
            received_amount: totalReceived,
            change_amount: totalChange,
            status: nextStatus,
        });

        if (nextStatus === OrderStatus.Completed) {
            await manager.query(
                `UPDATE sales_order_item
                 SET status = $1
                 WHERE order_id = $2
                   AND status::text NOT IN ('Cancelled', 'cancelled')`,
                [OrderStatus.Paid, orderId],
            );
        }

        if (nextStatus === OrderStatus.Completed && order.table_id) {
            await tablesRepo.update(order.table_id, { status: TableStatus.Available });
            this.invalidateTableCache(order.branch_id || branchId, order.table_id);

            const table = await tablesRepo.findOneBy({ id: order.table_id });
            const effectiveBranchId = order.branch_id || branchId;
            if (table && effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, table);
            }
        }

        const refreshedOrder = await orderRepo.findOne({
            where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId },
        });
        const effectiveBranchId = refreshedOrder?.branch_id || branchId;
        if (refreshedOrder && effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, refreshedOrder);
        }
    }

    async create(payments: Payments, userId: string, branchId?: string, access?: AccessContext): Promise<Payments> {
        return runInTransaction(async (manager) => {
            if (!payments.order_id) {
                throw AppError.badRequest("Order id is required");
            }
            if (!payments.payment_method_id) {
                throw AppError.badRequest("Payment method id is required");
            }

            const amount = Number(payments.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                throw AppError.badRequest("Payment amount must be greater than 0");
            }

            const orderRepo = manager.getRepository(SalesOrder);
            const order = await orderRepo
                .createQueryBuilder("order")
                .setLock("pessimistic_write")
                .where("order.id = :orderId", { orderId: payments.order_id })
                .andWhere(branchId ? "order.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
                .getOne();

            if (!order) {
                throw AppError.notFound("Order");
            }

            if (access?.scope === "none") {
                throw AppError.forbidden("Access denied");
            }
            if (access?.scope === "own") {
                if (!access.actorUserId) {
                    throw AppError.forbidden("Access denied");
                }
                if (order.created_by_id !== access.actorUserId) {
                    throw AppError.forbidden("Access denied: Own scope only");
                }
            }

            if (isCancelledStatus(order.status)) {
                throw AppError.conflict("Order is cancelled");
            }
            if (order.status === OrderStatus.Completed || order.status === OrderStatus.Paid) {
                throw AppError.conflict("Order is already settled");
            }

            const effectiveBranchId = order.branch_id || branchId;
            if (effectiveBranchId) {
                payments.branch_id = effectiveBranchId;
            }

            if (effectiveBranchId) {
                const paymentMethod = await manager.getRepository(PaymentMethod).findOneBy({
                    id: payments.payment_method_id,
                    branch_id: effectiveBranchId,
                } as any);
                if (!paymentMethod) {
                    throw AppError.notFound("Payment method");
                }
            }

            const amountReceived = payments.amount_received !== undefined ? Number(payments.amount_received) : amount;
            if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                throw AppError.badRequest("Received amount must be greater than or equal to payment amount");
            }

            const paymentStatus = payments.status ?? PaymentStatus.Success;
            payments.amount = amount;
            payments.amount_received = amountReceived;
            payments.change_amount = Number((amountReceived - amount).toFixed(2));
            payments.status = paymentStatus;

            if (paymentStatus === PaymentStatus.Success) {
                const successfulPayments = await manager.getRepository(Payments).find({
                    where: {
                        order_id: order.id,
                        status: PaymentStatus.Success,
                    },
                });

                const totalPaid = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                const remainingDue = Number((Number(order.total_amount || 0) - totalPaid).toFixed(2));

                if (remainingDue <= 0) {
                    throw AppError.conflict("Order is already fully paid");
                }

                if (amount > remainingDue + 0.009) {
                    throw AppError.conflict("Payment amount exceeds outstanding balance");
                }
            }

            const activeShift = await this.shiftsService.getCurrentShift(effectiveBranchId || branchId);
            if (!activeShift) {
                throw AppError.badRequest("Active shift is required before taking payment");
            }
            payments.shift_id = activeShift.id;

            const createdPayment = await this.paymentsModel.create(payments, manager);
            await this.refreshOrderPaymentSummary(createdPayment.order_id, manager, branchId);

            return createdPayment;
        }).then(async (createdPayment) => {
            const completePayment = await this.paymentsModel.findOne(createdPayment.id, branchId, access);
            if (completePayment) {
                const effectiveBranchId = completePayment.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.payments.create, completePayment);
                }
                return completePayment;
            }
            return createdPayment;
        });
    }

    async update(id: string, payments: Payments, branchId?: string, access?: AccessContext): Promise<Payments> {
        return runInTransaction(async (manager) => {
            const existingPayment = await this.findAccessiblePayment(id, manager, branchId, access);

            if (!existingPayment) {
                throw AppError.notFound("Payment");
            }

            if (payments.order_id && payments.order_id !== existingPayment.order_id) {
                throw AppError.badRequest("Order on payment record cannot be changed");
            }

            if (payments.amount !== undefined) {
                const amount = Number(payments.amount);
                if (!Number.isFinite(amount) || amount <= 0) {
                    throw AppError.badRequest("Payment amount must be greater than 0");
                }
                payments.amount = amount;
            }

            if (payments.amount_received !== undefined || payments.amount !== undefined) {
                const amount = Number(payments.amount ?? existingPayment.amount);
                const amountReceived = Number(payments.amount_received ?? existingPayment.amount_received ?? amount);
                if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                    throw AppError.badRequest("Received amount must be greater than or equal to payment amount");
                }
                payments.amount_received = amountReceived;
                payments.change_amount = Number((amountReceived - amount).toFixed(2));
            }

            const effectiveBranchId = existingPayment.branch_id || branchId;
            if (effectiveBranchId) {
                payments.branch_id = effectiveBranchId;
            }

            if (payments.payment_method_id && effectiveBranchId) {
                const paymentMethod = await manager.getRepository(PaymentMethod).findOneBy({
                    id: payments.payment_method_id,
                    branch_id: effectiveBranchId,
                } as any);
                if (!paymentMethod) {
                    throw AppError.notFound("Payment method");
                }
            }

            await this.paymentsModel.update(id, payments, manager);
            await this.refreshOrderPaymentSummary(existingPayment.order_id, manager, branchId);

            return existingPayment;
        }).then(async () => {
            const updatedPayment = await this.paymentsModel.findOne(id, branchId, access);
            if (!updatedPayment) {
                throw AppError.internal("Failed to reload updated payment");
            }

            const effectiveBranchId = updatedPayment.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.payments.update, updatedPayment);
            }
            return updatedPayment;
        });
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        return runInTransaction(async (manager) => {
            const payment = await this.findAccessiblePayment(id, manager, branchId, access);

            if (!payment) {
                throw AppError.notFound("Payment");
            }

            await this.paymentsModel.delete(id, manager);
            if (payment.order_id) {
                await this.refreshOrderPaymentSummary(payment.order_id, manager, branchId);
            }

            return payment.branch_id || branchId || null;
        }).then((emitBranchId) => {
            if (emitBranchId) {
                this.socketService.emitToBranch(emitBranchId, RealtimeEvents.payments.delete, { id });
            }
        });
    }
}
