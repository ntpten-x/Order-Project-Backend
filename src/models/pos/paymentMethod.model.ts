import { AppDataSource } from "../../database/database";
import { PaymentMethod } from "../../entity/pos/PaymentMethod";

export class PaymentMethodModels {
    private paymentMethodRepository = AppDataSource.getRepository(PaymentMethod)

    async findAll(page: number = 1, limit: number = 50, q?: string, branchId?: string): Promise<{ data: PaymentMethod[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;
            const query = this.paymentMethodRepository.createQueryBuilder("paymentMethod")
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
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }
            return this.paymentMethodRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(payment_method_name: string, branchId?: string): Promise<PaymentMethod | null> {
        try {
            const where: any = { payment_method_name };
            if (branchId) {
                where.branch_id = branchId;
            }
            return this.paymentMethodRepository.findOneBy(where)
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
