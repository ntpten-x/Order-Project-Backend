import { PaymentsModels } from "../../models/pos/payments.model";
import { SocketService } from "../socket.service";
import { Payments } from "../../entity/pos/Payments";

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

    async create(payments: Payments): Promise<Payments> {
        try {
            if (!payments.order_id) {
                throw new Error("กรุณาระบุรหัสออเดอร์")
            }
            if (!payments.payment_method_id) {
                throw new Error("กรุณาระบุรหัสวิธีการชำระเงิน")
            }
            if (payments.amount <= 0) {
                throw new Error("ยอดเงินที่ชำระต้องมากกว่า 0")
            }

            const createdPayment = await this.paymentsModel.create(payments)

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

            const updatedPayment = await this.paymentsModel.update(id, payments)
            this.socketService.emit('payments:update', updatedPayment)
            return updatedPayment
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.paymentsModel.delete(id)
            this.socketService.emit('payments:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
