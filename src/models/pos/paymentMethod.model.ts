import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { getRepository } from "../../database/dbContext";

export class PaymentMethodModels {
    async findAll(page: number = 1, limit: number = 50, q?: string, branchId?: string): Promise<{ data: PaymentMethod[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;
            const paymentMethodRepository = getRepository(PaymentMethod);
            const query = paymentMethodRepository.createQueryBuilder("paymentMethod")
                .orderBy("paymentMethod.create_date", "ASC");

            if (branchId) {
                query.andWhere("paymentMethod.branch_id = :branchId", { branchId });
            }

            if (q && q.trim()) {
                query.andWhere("(paymentMethod.payment_method_name ILIKE :q OR paymentMethod.display_name ILIKE :q)", { q: `%${q.trim()}%` });
            }

            const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
            return {
                data,
                total,
                page,
                last_page: Math.max(1, Math.ceil(total / limit))
            };
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<PaymentMethod | null> {
        try {
            const paymentMethodRepository = getRepository(PaymentMethod);
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }
            return paymentMethodRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(payment_method_name: string, branchId?: string): Promise<PaymentMethod | null> {
        try {
            const paymentMethodRepository = getRepository(PaymentMethod);
            const where: any = { payment_method_name };
            if (branchId) {
                where.branch_id = branchId;
            }
            return paymentMethodRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async create(data: PaymentMethod): Promise<PaymentMethod> {
        try {
            return getRepository(PaymentMethod).save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: PaymentMethod, branchId?: string): Promise<PaymentMethod> {
        try {
            const paymentMethodRepository = getRepository(PaymentMethod);
            if (branchId) {
                await paymentMethodRepository.update({ id, branch_id: branchId } as any, data)
            } else {
                await paymentMethodRepository.update(id, data)
            }

            const updatedPaymentMethod = await this.findOne(id, branchId)
            if (!updatedPaymentMethod) {
                throw new Error("ไม่พบข้อมูลวิธีการชำระเงินที่ต้องการค้นหา")
            }
            return updatedPaymentMethod
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const paymentMethodRepository = getRepository(PaymentMethod);
            if (branchId) {
                await paymentMethodRepository.delete({ id, branch_id: branchId } as any)
            } else {
                await paymentMethodRepository.delete(id)
            }
        } catch (error) {
            throw error
        }
    }
}
