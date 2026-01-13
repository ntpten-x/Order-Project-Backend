import { AppDataSource } from "../../database/database";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";

export class PaymentMethodModels {
    private paymentMethodRepository = AppDataSource.getRepository(PaymentMethod)

    async findAll(): Promise<PaymentMethod[]> {
        try {
            return this.paymentMethodRepository.find({
                order: {
                    create_date: "ASC"
                }
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<PaymentMethod | null> {
        try {
            return this.paymentMethodRepository.findOneBy({ id })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(payment_method_name: string): Promise<PaymentMethod | null> {
        try {
            return this.paymentMethodRepository.findOneBy({ payment_method_name })
        } catch (error) {
            throw error
        }
    }

    async create(data: PaymentMethod): Promise<PaymentMethod> {
        try {
            return this.paymentMethodRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: PaymentMethod): Promise<PaymentMethod> {
        try {
            await this.paymentMethodRepository.update(id, data)
            const updatedPaymentMethod = await this.findOne(id)
            if (!updatedPaymentMethod) {
                throw new Error("ไม่พบข้อมูลวิธีการชำระเงินที่ต้องการค้นหา")
            }
            return updatedPaymentMethod
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.paymentMethodRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
