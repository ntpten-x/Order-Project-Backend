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
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const discountsRepository = getRepository(Discounts);
        const query = discountsRepository
            .createQueryBuilder("discounts")
            .orderBy("discounts.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("discounts.branch_id = :branchId", { branchId });
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere(
                "(LOWER(discounts.display_name) LIKE :q OR LOWER(COALESCE(discounts.description, '')) LIKE :q)",
                { q }
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
    }

    async findAll(q?: string, branchId?: string, sortCreated: CreatedSort = "old"): Promise<Discounts[]> {
        const discountsRepository = getRepository(Discounts);
        const query = discountsRepository
            .createQueryBuilder("discounts")
            .orderBy("discounts.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("discounts.branch_id = :branchId", { branchId });
        }

        if (q?.trim()) {
            const normalizedQuery = `%${q.trim().toLowerCase()}%`;
            query.andWhere(
                "(LOWER(discounts.display_name) LIKE :q OR LOWER(COALESCE(discounts.description, '')) LIKE :q)",
                { q: normalizedQuery }
            );
        }

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<Discounts | null> {
        const discountsRepository = getRepository(Discounts);
        const query = discountsRepository
            .createQueryBuilder("discounts")
            .where("discounts.id = :id", { id });

        if (branchId) {
            query.andWhere("discounts.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(name: string, branchId?: string): Promise<Discounts | null> {
        const normalizedName = name.trim().toLowerCase();
        const discountsRepository = getRepository(Discounts);
        const query = discountsRepository
            .createQueryBuilder("discounts")
            .where("LOWER(TRIM(discounts.display_name)) = :name", { name: normalizedName });

        if (branchId) {
            query.andWhere("discounts.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<Discounts>): Promise<Discounts> {
        const discountsRepository = getRepository(Discounts);
        const entity = discountsRepository.create(data);
        return discountsRepository.save(entity);
    }

    async update(id: string, data: Partial<Discounts>, branchId?: string): Promise<Discounts> {
        const discountsRepository = getRepository(Discounts);
        if (branchId) {
            await discountsRepository.update({ id, branch_id: branchId } as any, data);
        } else {
            await discountsRepository.update(id, data);
        }

        const updatedDiscount = await this.findOne(id, branchId);
        if (!updatedDiscount) {
            throw new Error("Discount not found after update");
        }

        return updatedDiscount;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const discountsRepository = getRepository(Discounts);
        if (branchId) {
            await discountsRepository.delete({ id, branch_id: branchId } as any);
        } else {
            await discountsRepository.delete(id);
        }
    }
}
