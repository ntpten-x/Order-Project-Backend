import { Discounts } from "../../entity/pos/Discounts";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class DiscountsModels {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive"; type?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Discounts[]; total: number; page: number; limit: number; last_page: number }> {
        try {
            const safePage = Math.max(page, 1);
            const safeLimit = Math.min(Math.max(limit, 1), 200);
            const discountsRepository = getRepository(Discounts);
            const query = discountsRepository.createQueryBuilder("discounts")
                .orderBy("discounts.create_date", createdSortToOrder(sortCreated));

            if (branchId) {
                query.andWhere("discounts.branch_id = :branchId", { branchId });
            }

            const qValue = filters?.q;
            if (qValue && qValue.trim()) {
                query.andWhere(
                    "(discounts.discount_name ILIKE :q OR discounts.display_name ILIKE :q OR discounts.description ILIKE :q)",
                    { q: `%${qValue.trim()}%` }
                );
            }

            if (filters?.status === "active") {
                query.andWhere("discounts.is_active = true");
            } else if (filters?.status === "inactive") {
                query.andWhere("discounts.is_active = false");
            }

            if (filters?.type?.trim()) {
                query.andWhere("discounts.discount_type = :type", { type: filters.type.trim() });
            }

            query.skip((safePage - 1) * safeLimit).take(safeLimit);
            const [data, total] = await query.getManyAndCount();
            const last_page = Math.max(Math.ceil(total / safeLimit), 1);
            return { data, total, page: safePage, limit: safeLimit, last_page };
        } catch (error) {
            throw error;
        }
    }

    async findAll(q?: string, branchId?: string, sortCreated: CreatedSort = "old"): Promise<Discounts[]> {
        try {
            const discountsRepository = getRepository(Discounts);
            const query = discountsRepository.createQueryBuilder("discounts")
                .orderBy("discounts.create_date", createdSortToOrder(sortCreated));

            if (branchId) {
                query.andWhere("discounts.branch_id = :branchId", { branchId });
            }

            if (q && q.trim()) {
                query.andWhere(
                    "(discounts.discount_name ILIKE :q OR discounts.display_name ILIKE :q OR discounts.description ILIKE :q)",
                    { q: `%${q.trim()}%` }
                );
            }

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Discounts | null> {
        try {
            const discountsRepository = getRepository(Discounts);
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }
            return discountsRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(discount_name: string, branchId?: string): Promise<Discounts | null> {
        try {
            const discountsRepository = getRepository(Discounts);
            const where: any = { discount_name };
            if (branchId) {
                where.branch_id = branchId;
            }
            return discountsRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async findOneByDisplayName(display_name: string, branchId?: string): Promise<Discounts | null> {
        try {
            const discountsRepository = getRepository(Discounts);
            const where: any = { display_name };
            if (branchId) {
                where.branch_id = branchId;
            }
            return discountsRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async create(data: Discounts): Promise<Discounts> {
        try {
            return getRepository(Discounts).save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Discounts, branchId?: string): Promise<Discounts> {
        try {
            const discountsRepository = getRepository(Discounts);
            if (branchId) {
                await discountsRepository.update({ id, branch_id: branchId } as any, data)
            } else {
                await discountsRepository.update(id, data)
            }

            const updatedDiscount = await this.findOne(id, branchId)
            if (!updatedDiscount) {
                throw new Error("ไม่พบข้อมูลส่วนลดที่ต้องการค้นหา")
            }
            return updatedDiscount
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const discountsRepository = getRepository(Discounts);
            if (branchId) {
                await discountsRepository.delete({ id, branch_id: branchId } as any)
            } else {
                await discountsRepository.delete(id)
            }
        } catch (error) {
            throw error
        }
    }
}
