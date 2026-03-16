import { getRepository } from "../../database/dbContext";
import { ToppingGroup } from "../../entity/pos/ToppingGroup";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class ToppingGroupModels {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: ToppingGroup[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const repository = getRepository(ToppingGroup);
        const query = repository
            .createQueryBuilder("topping_group")
            .orderBy("topping_group.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("topping_group.branch_id = :branchId", { branchId });
        }

        if (filters?.status === "active") {
            query.andWhere("topping_group.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("topping_group.is_active = false");
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere("LOWER(topping_group.display_name) LIKE :q", { q });
        }

        query.skip((safePage - 1) * safeLimit).take(safeLimit);
        const [data, total] = await query.getManyAndCount();
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);

        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<ToppingGroup[]> {
        const repository = getRepository(ToppingGroup);
        const query = repository
            .createQueryBuilder("topping_group")
            .orderBy("topping_group.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("topping_group.branch_id = :branchId", { branchId });
        }

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<ToppingGroup | null> {
        const repository = getRepository(ToppingGroup);
        const query = repository
            .createQueryBuilder("topping_group")
            .where("topping_group.id = :id", { id });

        if (branchId) {
            query.andWhere("topping_group.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(name: string, branchId?: string): Promise<ToppingGroup | null> {
        const normalizedName = name.trim().toLowerCase();
        const repository = getRepository(ToppingGroup);
        const query = repository
            .createQueryBuilder("topping_group")
            .where("LOWER(TRIM(topping_group.display_name)) = :name", { name: normalizedName });

        if (branchId) {
            query.andWhere("topping_group.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<ToppingGroup>): Promise<ToppingGroup> {
        const repository = getRepository(ToppingGroup);
        const entity = repository.create(data);
        return repository.save(entity);
    }

    async update(id: string, data: Partial<ToppingGroup>, branchId?: string): Promise<ToppingGroup> {
        const repository = getRepository(ToppingGroup);
        if (branchId) {
            await repository.update({ id, branch_id: branchId } as any, data);
        } else {
            await repository.update(id, data);
        }

        const updated = await this.findOne(id, branchId);
        if (!updated) {
            throw new Error("Topping group not found after update");
        }

        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const repository = getRepository(ToppingGroup);
        if (branchId) {
            await repository.delete({ id, branch_id: branchId } as any);
        } else {
            await repository.delete(id);
        }
    }
}
