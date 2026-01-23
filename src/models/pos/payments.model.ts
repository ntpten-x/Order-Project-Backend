import { AppDataSource } from "../../database/database";
import { Payments } from "../../entity/pos/Payments";
import { EntityManager } from "typeorm";

export class PaymentsModels {
    private paymentsRepository = AppDataSource.getRepository(Payments)

    async findAll(): Promise<Payments[]> {
        try {
            return this.paymentsRepository.find({
                order: {
                    payment_date: "DESC"
                },
                relations: ["order", "payment_method"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Payments | null> {
        try {
            return this.paymentsRepository.findOne({
                where: { id },
                relations: ["order", "payment_method"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: Payments, manager?: EntityManager): Promise<Payments> {
        try {
            const repo = manager ? manager.getRepository(Payments) : this.paymentsRepository;
            return repo.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Payments, manager?: EntityManager): Promise<Payments> {
        try {
            const repo = manager ? manager.getRepository(Payments) : this.paymentsRepository;
            await repo.update(id, data)
            // Note: findOne typically relies on default repo. In transaction, we might want to query using manager.
            // But reuse findOne here is okay if we are careful or if strict read consistency isn't violated.
            // To be safe inside transaction, create locally:
            const updatedPayment = await repo.findOne({
                where: { id },
                relations: ["order", "payment_method"]
            })

            if (!updatedPayment) {
                throw new Error("ไม่พบข้อมูลการชำระเงินที่ต้องการค้นหา")
            }
            return updatedPayment
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, manager?: EntityManager): Promise<void> {
        try {
            const repo = manager ? manager.getRepository(Payments) : this.paymentsRepository;
            await repo.delete(id)
        } catch (error) {
            throw error
        }
    }
}
