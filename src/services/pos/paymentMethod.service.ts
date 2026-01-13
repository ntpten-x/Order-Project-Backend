import { PaymentMethodModels } from "../../models/pos/paymentMethod.model";
import { SocketService } from "../socket.service";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";

export class PaymentMethodService {
    private socketService = SocketService.getInstance();

    constructor(private paymentMethodModel: PaymentMethodModels) { }

    async findAll(): Promise<PaymentMethod[]> {
        try {
            return this.paymentMethodModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<PaymentMethod | null> {
        try {
            return this.paymentMethodModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async create(paymentMethod: PaymentMethod): Promise<PaymentMethod> {
        try {
            if (!paymentMethod.payment_method_name) {
                throw new Error("กรุณาระบุชื่อวิธีการชำระเงิน")
            }

            const existingPaymentMethod = await this.paymentMethodModel.findOneByName(paymentMethod.payment_method_name)
            if (existingPaymentMethod) {
                throw new Error("ชื่อวิธีการชำระเงินนี้มีอยู่ในระบบแล้ว")
            }

            const createdPaymentMethod = await this.paymentMethodModel.create(paymentMethod)
            this.socketService.emit('paymentMethod:create', createdPaymentMethod)
            return createdPaymentMethod
        } catch (error) {
            throw error
        }
    }

    async update(id: string, paymentMethod: PaymentMethod): Promise<PaymentMethod> {
        try {
            const paymentMethodToUpdate = await this.paymentMethodModel.findOne(id)
            if (!paymentMethodToUpdate) {
                throw new Error("ไม่พบข้อมูลวิธีการชำระเงินที่ต้องการแก้ไข")
            }

            if (paymentMethod.payment_method_name && paymentMethod.payment_method_name !== paymentMethodToUpdate.payment_method_name) {
                const existingPaymentMethod = await this.paymentMethodModel.findOneByName(paymentMethod.payment_method_name)
                if (existingPaymentMethod) {
                    throw new Error("ชื่อวิธีการชำระเงินนี้มีอยู่ในระบบแล้ว")
                }
            }

            const updatedPaymentMethod = await this.paymentMethodModel.update(id, paymentMethod)
            this.socketService.emit('paymentMethod:update', updatedPaymentMethod)
            return updatedPaymentMethod
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.paymentMethodModel.delete(id)
            this.socketService.emit('paymentMethod:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
