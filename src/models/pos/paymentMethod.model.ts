import { PaymentMethod } from "../../entity/pos/PaymentMethod";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class PaymentMethodModels {
    async findAll(
        page: number = 1,
        limit: number = 50,
        q?: string,
        status?: "active" | "inactive",
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: PaymentMethod[]; total: number; page: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const skip = (safePage - 1) * safeLimit;
        const paymentMethodRepository = getRepository(PaymentMethod);
        const query = paymentMethodRepository
            .createQueryBuilder("paymentMethod")
            .orderBy("paymentMethod.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("paymentMethod.branch_id = :branchId", { branchId });
        }

        if (q?.trim()) {
            const normalizedQuery = `%${q.trim().toLowerCase()}%`;
            query.andWhere(
                "(LOWER(paymentMethod.payment_method_name) LIKE :q OR LOWER(paymentMethod.display_name) LIKE :q)",
                { q: normalizedQuery }
            );
        }

        if (status === "active") {
            query.andWhere("paymentMethod.is_active = true");
        } else if (status === "inactive") {
            query.andWhere("paymentMethod.is_active = false");
        }

        const [data, total] = await query.skip(skip).take(safeLimit).getManyAndCount();
        return {
            data,
            total,
            page: safePage,
            last_page: Math.max(1, Math.ceil(total / safeLimit)),
        };
    }

    async findOne(id: string, branchId?: string): Promise<PaymentMethod | null> {
        const paymentMethodRepository = getRepository(PaymentMethod);
        const query = paymentMethodRepository
            .createQueryBuilder("paymentMethod")
            .where("paymentMethod.id = :id", { id });

        if (branchId) {
            query.andWhere("paymentMethod.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(payment_method_name: string, branchId?: string): Promise<PaymentMethod | null> {
        const normalizedName = payment_method_name.trim().toLowerCase();
        const paymentMethodRepository = getRepository(PaymentMethod);
        const query = paymentMethodRepository
            .createQueryBuilder("paymentMethod")
            .where("LOWER(TRIM(paymentMethod.payment_method_name)) = :paymentMethodName", { paymentMethodName: normalizedName });

        if (branchId) {
            query.andWhere("paymentMethod.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<PaymentMethod>): Promise<PaymentMethod> {
        const paymentMethodRepository = getRepository(PaymentMethod);
        const entity = paymentMethodRepository.create(data);
        return paymentMethodRepository.save(entity);
    }

    async update(id: string, data: Partial<PaymentMethod>, branchId?: string): Promise<PaymentMethod> {
        const paymentMethodRepository = getRepository(PaymentMethod);
        if (branchId) {
            await paymentMethodRepository.update({ id, branch_id: branchId } as any, data);
        } else {
            await paymentMethodRepository.update(id, data);
        }

        const updatedPaymentMethod = await this.findOne(id, branchId);
        if (!updatedPaymentMethod) {
            throw new Error("Payment method not found after update");
        }
        return updatedPaymentMethod;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const paymentMethodRepository = getRepository(PaymentMethod);
        if (branchId) {
            await paymentMethodRepository.delete({ id, branch_id: branchId } as any);
        } else {
            await paymentMethodRepository.delete(id);
        }
    }
}
