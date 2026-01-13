import { AppDataSource } from "../../database/database";
import { PaymentDetails } from "../../entity/pos/PaymentDetails";

export class PaymentDetailsModels {
    private paymentDetailsRepository = AppDataSource.getRepository(PaymentDetails)

    async findAll(): Promise<PaymentDetails[]> {
        try {
            return this.paymentDetailsRepository.find({
                order: {
                    create_date: "ASC"
                },
                relations: ["payment"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<PaymentDetails | null> {
        try {
            return this.paymentDetailsRepository.findOne({
                where: { id },
                relations: ["payment"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: PaymentDetails): Promise<PaymentDetails> {
        try {
            return this.paymentDetailsRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: PaymentDetails): Promise<PaymentDetails> {
        try {
            await this.paymentDetailsRepository.update(id, data)
            const updatedDetail = await this.findOne(id)
            if (!updatedDetail) {
                throw new Error("ไม่พบข้อมูลรายละเอียดการชำระเงินที่ต้องการค้นหา")
            }
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.paymentDetailsRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
