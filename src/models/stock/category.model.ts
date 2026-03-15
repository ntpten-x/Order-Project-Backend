import { getRepository } from "../../database/dbContext";
import { StockCategory } from "../../entity/stock/Category";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class StockCategoryModel {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: StockCategory[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const repository = getRepository(StockCategory);
        const query = repository
            .createQueryBuilder("category")
            .orderBy("category.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        if (filters?.status === "active") {
            query.andWhere("category.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("category.is_active = false");
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere("LOWER(category.display_name) LIKE :q", { q });
        }

        query
            .addOrderBy("category.is_active", "DESC")
            .addOrderBy("category.id", "ASC")
            .skip((safePage - 1) * safeLimit)
            .take(safeLimit);

        const [data, total] = await query.getManyAndCount();
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);
        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<StockCategory[]> {
        const repository = getRepository(StockCategory);
        const query = repository
            .createQueryBuilder("category")
            .orderBy("category.create_date", createdSortToOrder(sortCreated))
            .addOrderBy("category.is_active", "DESC")
            .addOrderBy("category.id", "ASC");

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<StockCategory | null> {
        const repository = getRepository(StockCategory);
        const query = repository.createQueryBuilder("category").where("category.id = :id", { id });

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(name: string, branchId?: string): Promise<StockCategory | null> {
        const normalizedName = name.trim().toLowerCase();
        const repository = getRepository(StockCategory);
        const query = repository
            .createQueryBuilder("category")
            .where("LOWER(TRIM(category.display_name)) = :name", { name: normalizedName });

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<StockCategory>): Promise<StockCategory> {
        const repository = getRepository(StockCategory);
        return repository.save(repository.create(data));
    }

    async update(id: string, data: Partial<StockCategory>, branchId?: string): Promise<StockCategory> {
        const repository = getRepository(StockCategory);
        if (branchId) {
            await repository.update({ id, branch_id: branchId } as any, data);
        } else {
            await repository.update(id, data);
        }

        const updated = await this.findOne(id, branchId);
        if (!updated) {
            throw new Error("Stock category not found after update");
        }

        return updated;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const repository = getRepository(StockCategory);
        if (branchId) {
            await repository.delete({ id, branch_id: branchId } as any);
            return;
        }

        await repository.delete(id);
    }
}
