import { PaymentsModels } from "../../models/pos/payments.model";
import { SocketService } from "../socket.service";
import { Payments, PaymentStatus } from "../../entity/pos/Payments";
import { ShiftsService } from "./shifts.service";
import { AppError } from "../../utils/AppError";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { Tables, TableStatus } from "../../entity/pos/Tables";
import { EntityManager } from "typeorm";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { getDbManager, runInTransaction } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class PaymentsService {
    private socketService = SocketService.getInstance();

    constructor(private paymentsModel: PaymentsModels) { }

    async findAll(branchId?: string): Promise<Payments[]> {
        try {
            return this.paymentsModel.findAll(branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Payments | null> {
        try {
            return this.paymentsModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    private shiftsService = new ShiftsService();

    private async refreshOrderPaymentSummary(orderId: string, manager: EntityManager = getDbManager(), branchId?: string): Promise<void> {
        const orderRepo = manager.getRepository(SalesOrder);
        const paymentsRepo = manager.getRepository(Payments);
        const tablesRepo = manager.getRepository(Tables);

        const order = await orderRepo.findOne({ where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId } });
        if (!order) return;

        const payments = await paymentsRepo.find({
            where: { order_id: orderId, status: PaymentStatus.Success }
        });

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount_received || 0), 0);
        const totalChange = payments.reduce((sum, p) => sum + Number(p.change_amount || 0), 0);

        const nextStatus =
            order.status === OrderStatus.Cancelled
                ? OrderStatus.Cancelled
                : totalPaid >= Number(order.total_amount)
                    ? OrderStatus.Completed // Order is Completed
                    : order.status;

        await orderRepo.update(orderId, {
            received_amount: totalReceived,
            change_amount: totalChange,
            status: nextStatus
        });

        // Loop update all items to Paid if Order is Completed
        if (nextStatus === OrderStatus.Completed) {
            // Logic to update all items to Paid could go here or be assumed by Completed status
            // ideally we explicitly update them as per requirement "Items... Paid"
            // But let's first check if we should do it here. The prompt says "Items ... Paid".
            // We can do a bulk update.
            const effectiveBranchId = order.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, { ...order, status: nextStatus } as SalesOrder);
            }

            // Update all items to Paid
            //  const itemsRepo = manager.getRepository(SalesOrderItem); // Need to import or use QueryBuilder
            //  await itemsRepo.update({ order_id: orderId }, { status: OrderStatus.Paid });

            // Wait, removing imports might be messy if I don't check what's imported.
            // Let's use custom query or existing connection.
            await manager.query(`UPDATE sales_order_item SET status = $1 WHERE order_id = $2`, [OrderStatus.Paid, orderId]);
        }

        if (nextStatus === OrderStatus.Completed && order.table_id) {
            await tablesRepo.update(order.table_id, { status: TableStatus.Available });
            const t = await tablesRepo.findOneBy({ id: order.table_id });
            if (t) {
                const effectiveBranchId = order.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.tables.update, t);
                }
            }
        }

        const refreshedOrder = await orderRepo.findOne({ where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId } });
        if (refreshedOrder) {
            const effectiveBranchId = refreshedOrder.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.orders.update, refreshedOrder);
            }
        }
    }

    async create(payments: Payments, userId: string, branchId?: string): Promise<Payments> {
        return await runInTransaction(async (manager) => {
            try {
                if (!payments.order_id) {
                    throw new Error("กรุณาระบุรหัสออเดอร์")
                }
                if (!payments.payment_method_id) {
                    throw new Error("กรุณาระบุรหัสวิธีการชำระเงิน")
                }

                const amount = Number(payments.amount);
                if (!Number.isFinite(amount) || amount <= 0) {
                    throw new Error("ยอดเงินที่ชำระต้องมากกว่า 0")
                }

                const orderRepo = manager.getRepository(SalesOrder);
                const order = await orderRepo.findOne({ where: branchId ? ({ id: payments.order_id, branch_id: branchId } as any) : { id: payments.order_id } });
                if (!order) {
                    throw new AppError("ไม่พบออเดอร์", 404);
                }
                if (order.status === OrderStatus.Cancelled) {
                    throw new AppError("ออเดอร์ถูกยกเลิกแล้ว", 400);
                }

                const effectiveBranchId = order.branch_id || branchId;
                if (effectiveBranchId) {
                    payments.branch_id = effectiveBranchId;
                }

                // Validate payment method belongs to branch
                if (effectiveBranchId) {
                    const pm = await manager.getRepository(PaymentMethod).findOneBy({ id: payments.payment_method_id, branch_id: effectiveBranchId } as any);
                    if (!pm) throw new AppError("Payment method not found for this branch", 404);
                }

                const amountReceived = payments.amount_received !== undefined ? Number(payments.amount_received) : amount;
                if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                    throw new AppError("ยอดเงินที่รับต้องไม่น้อยกว่ายอดชำระ", 400);
                }

                payments.amount = amount;
                payments.amount_received = amountReceived;
                payments.change_amount = Number((amountReceived - amount).toFixed(2));

                // Link to Active Shift
                const activeShift = await this.shiftsService.getCurrentShift(effectiveBranchId || branchId);
                if (!activeShift) {
                    throw new AppError("กรุณาเปิดกะก่อนทำรายการชำระเงิน (Open Shift Required)", 400);
                }
                payments.shift_id = activeShift.id;

                const createdPayment = await this.paymentsModel.create(payments, manager)

                await this.refreshOrderPaymentSummary(createdPayment.order_id, manager, branchId);

                return createdPayment;
            } catch (error) {
                throw error
            }
        }).then(async (createdPayment) => {
            // Fetch complete data with relations to return AFTER transaction commits
            const completePayment = await this.paymentsModel.findOne(createdPayment.id, branchId)
            if (completePayment) {
                const effectiveBranchId = completePayment.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.payments.create, completePayment);
                }
                return completePayment
            }
            return createdPayment
        })
    }

    async update(id: string, payments: Payments, branchId?: string): Promise<Payments> {
        return await runInTransaction(async (manager) => {
            try {
                const paymentToUpdate = await this.paymentsModel.findOne(id, branchId) // Read-only is fine outside, but for strictness we could re-query inside. 
                // However, findOne in model typically uses default repo. Let's assume concurrency is handled by optimistic check or DB locks if critical.
                // For now, re-reading inside isn't easy without exposing manager to model fully.
                // But we CAN use manager here.

                const paymentsRepo = manager.getRepository(Payments);
                const existingPayment = await paymentsRepo.findOneBy(branchId ? ({ id, branch_id: branchId } as any) : { id });

                if (!existingPayment) {
                    throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการแก้ไข")
                }

                if (payments.order_id && payments.order_id !== existingPayment.order_id) {
                    throw new AppError("ไม่สามารถเปลี่ยนออเดอร์ของรายการชำระเงินได้", 400);
                }

                if (payments.amount !== undefined) {
                    const amount = Number(payments.amount);
                    if (!Number.isFinite(amount) || amount <= 0) {
                        throw new AppError("ยอดเงินที่ชำระต้องมากกว่า 0", 400);
                    }
                    payments.amount = amount;
                }

                if (payments.amount_received !== undefined || payments.amount !== undefined) {
                    const amount = Number(payments.amount ?? existingPayment.amount);
                    const amountReceived = Number(payments.amount_received ?? existingPayment.amount_received ?? amount);
                    if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                        throw new AppError("ยอดเงินที่รับต้องไม่น้อยกว่ายอดชำระ", 400);
                    }
                    payments.amount_received = amountReceived;
                    payments.change_amount = Number((amountReceived - amount).toFixed(2));
                }

                const effectiveBranchId = existingPayment.branch_id || branchId;
                if (effectiveBranchId) {
                    payments.branch_id = effectiveBranchId;
                }

                if (payments.payment_method_id && effectiveBranchId) {
                    const pm = await manager.getRepository(PaymentMethod).findOneBy({ id: payments.payment_method_id, branch_id: effectiveBranchId } as any);
                    if (!pm) throw new AppError("Payment method not found for this branch", 404);
                }

                // Use model update with manager if possible, or repo update
                await this.paymentsModel.update(id, payments, manager)
                await this.refreshOrderPaymentSummary(existingPayment.order_id, manager, branchId);

                return existingPayment; // return placeholder, will refresh outside
            } catch (error) {
                throw error
            }
        }).then(async () => {
            const updatedPayment = await this.paymentsModel.findOne(id, branchId)
            if (updatedPayment) {
                const effectiveBranchId = updatedPayment.branch_id || branchId;
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.payments.update, updatedPayment);
                }
                return updatedPayment
            }
            throw new Error("Critical: Failed to retrieve updated payment");
        })
    }

    async delete(id: string, branchId?: string): Promise<void> {
        return await runInTransaction(async (manager) => {
            try {
                const paymentsRepo = manager.getRepository(Payments);
                const payment = await paymentsRepo.findOneBy(branchId ? ({ id, branch_id: branchId } as any) : { id });

                if (!payment) {
                    throw new AppError("Payment not found", 404);
                }

                await this.paymentsModel.delete(id, manager)
                if (payment.order_id) {
                    await this.refreshOrderPaymentSummary(payment.order_id, manager, branchId);
                }
            } catch (error) {
                throw error
            }
        }).then(() => {
            if (branchId) {
                this.socketService.emitToBranch(branchId, RealtimeEvents.payments.delete, { id })
            }
        })
    }
}
