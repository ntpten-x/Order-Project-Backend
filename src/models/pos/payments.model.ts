import { Payments } from "../../entity/pos/Payments";
import { EntityManager } from "typeorm";
import { getRepository } from "../../database/dbContext";

export class PaymentsModels {
    async findAll(branchId?: string): Promise<Payments[]> {
        try {
            const paymentsRepository = getRepository(Payments);
            const query = paymentsRepository.createQueryBuilder("payments")
                .leftJoinAndSelect("payments.order", "order")
                .leftJoinAndSelect("payments.payment_method", "payment_method")
                .orderBy("payments.payment_date", "DESC");

            if (branchId) {
                query.andWhere("payments.branch_id = :branchId", { branchId });
            }

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Payments | null> {
        try {
            const paymentsRepository = getRepository(Payments);
            const query = paymentsRepository.createQueryBuilder("payments")
                .leftJoinAndSelect("payments.order", "order")
                .leftJoinAndSelect("payments.payment_method", "payment_method")
                .where("payments.id = :id", { id });

            if (branchId) {
                query.andWhere("payments.branch_id = :branchId", { branchId });
            }

            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async create(data: Payments, manager?: EntityManager): Promise<Payments> {
        try {
            const repo = manager ? manager.getRepository(Payments) : getRepository(Payments);
            return repo.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Payments, manager?: EntityManager): Promise<Payments> {
        try {
            const repo = manager ? manager.getRepository(Payments) : getRepository(Payments);
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
            const repo = manager ? manager.getRepository(Payments) : getRepository(Payments);
            await repo.delete(id)
        } catch (error) {
            throw error
        }
    }
}
