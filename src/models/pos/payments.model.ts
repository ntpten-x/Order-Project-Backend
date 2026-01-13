import { AppDataSource } from "../../database/database";
import { Payments } from "../../entity/pos/Payment";

export class PaymentsModels {
    private paymentsRepository = AppDataSource.getRepository(Payments)

    async findAll(): Promise<Payments[]> {
        try {
            return this.paymentsRepository.find({
                order: {
                    payment_date: "DESC"
                },
                relations: ["order", "payment_method", "payment_details"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Payments | null> {
        try {
            return this.paymentsRepository.findOne({
                where: { id },
                relations: ["order", "payment_method", "payment_details"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: Payments): Promise<Payments> {
        try {
            return this.paymentsRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Payments): Promise<Payments> {
        try {
            await this.paymentsRepository.update(id, data)
            const updatedPayment = await this.findOne(id)
            if (!updatedPayment) {
                throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการค้นหา")
            }
            return updatedPayment
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.paymentsRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
