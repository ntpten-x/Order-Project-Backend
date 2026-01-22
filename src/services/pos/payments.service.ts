import { PaymentsModels } from "../../models/pos/payments.model";
import { SocketService } from "../socket.service";
import { Payments, PaymentStatus } from "../../entity/pos/Payments";
import { ShiftsService } from "./shifts.service";
import { AppError } from "../../utils/AppError";
import { AppDataSource } from "../../database/database";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { OrderStatus } from "../../entity/pos/OrderEnums";
import { Tables, TableStatus } from "../../entity/pos/Tables";

export class PaymentsService {
    private socketService = SocketService.getInstance();

    constructor(private paymentsModel: PaymentsModels) { }

    async findAll(): Promise<Payments[]> {
        try {
            return this.paymentsModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Payments | null> {
        try {
            return this.paymentsModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    private shiftsService = new ShiftsService();

    private async refreshOrderPaymentSummary(orderId: string): Promise<void> {
        const orderRepo = AppDataSource.getRepository(SalesOrder);
        const paymentsRepo = AppDataSource.getRepository(Payments);
        const tablesRepo = AppDataSource.getRepository(Tables);

        const order = await orderRepo.findOne({ where: { id: orderId } });
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
                    ? OrderStatus.Paid
                    : order.status;

        await orderRepo.update(orderId, {
            received_amount: totalReceived,
            change_amount: totalChange,
            status: nextStatus
        });

        if (nextStatus === OrderStatus.Paid && order.table_id) {
            await tablesRepo.update(order.table_id, { status: TableStatus.Available });
            const t = await tablesRepo.findOneBy({ id: order.table_id });
            if (t) this.socketService.emit("tables:update", t);
        }

        const refreshedOrder = await orderRepo.findOne({ where: { id: orderId } });
        if (refreshedOrder) this.socketService.emit("orders:update", refreshedOrder);
    }

    async create(payments: Payments, userId: string): Promise<Payments> {
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

            const orderRepo = AppDataSource.getRepository(SalesOrder);
            const order = await orderRepo.findOne({ where: { id: payments.order_id } });
            if (!order) {
                throw new AppError("ไม่พบออเดอร์", 404);
            }
            if (order.status === OrderStatus.Cancelled) {
                throw new AppError("ออเดอร์ถูกยกเลิกแล้ว", 400);
            }

            const amountReceived = payments.amount_received !== undefined ? Number(payments.amount_received) : amount;
            if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                throw new AppError("ยอดเงินที่รับต้องไม่น้อยกว่ายอดชำระ", 400);
            }

            payments.amount = amount;
            payments.amount_received = amountReceived;
            payments.change_amount = Number((amountReceived - amount).toFixed(2));

            // Link to Active Shift
            const activeShift = await this.shiftsService.getCurrentShift(userId);
            if (!activeShift) {
                throw new AppError("กรุณาเปิดกะก่อนทำรายการชำระเงิน (Open Shift Required)", 400);
            }
            payments.shift_id = activeShift.id;

            const createdPayment = await this.paymentsModel.create(payments)

            await this.refreshOrderPaymentSummary(createdPayment.order_id);

            // Fetch complete data with relations to return
            const completePayment = await this.paymentsModel.findOne(createdPayment.id)

            if (completePayment) {
                this.socketService.emit('payments:create', completePayment)
                return completePayment
            }
            return createdPayment
        } catch (error) {
            throw error
        }
    }

    async update(id: string, payments: Payments): Promise<Payments> {
        try {
            const paymentToUpdate = await this.paymentsModel.findOne(id)
            if (!paymentToUpdate) {
                throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการแก้ไข")
            }

            if (payments.order_id && payments.order_id !== paymentToUpdate.order_id) {
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
                const amount = Number(payments.amount ?? paymentToUpdate.amount);
                const amountReceived = Number(payments.amount_received ?? paymentToUpdate.amount_received ?? amount);
                if (!Number.isFinite(amountReceived) || amountReceived < amount) {
                    throw new AppError("ยอดเงินที่รับต้องไม่น้อยกว่ายอดชำระ", 400);
                }
                payments.amount_received = amountReceived;
                payments.change_amount = Number((amountReceived - amount).toFixed(2));
            }

            const updatedPayment = await this.paymentsModel.update(id, payments)
            await this.refreshOrderPaymentSummary(paymentToUpdate.order_id);

            this.socketService.emit('payments:update', updatedPayment)
            return updatedPayment
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const payment = await this.paymentsModel.findOne(id);
            await this.paymentsModel.delete(id)
            if (payment?.order_id) {
                await this.refreshOrderPaymentSummary(payment.order_id);
            }
            this.socketService.emit('payments:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
