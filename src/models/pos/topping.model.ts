import { Topping } from "../../entity/pos/Topping";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class ToppingModels {
    private createBaseQuery(
        filters?: { q?: string; status?: "active" | "inactive"; category_id?: string },
        branchId?: string
    ) {
        const toppingRepository = getRepository(Topping);
        const query = toppingRepository.createQueryBuilder("topping");

        if (branchId) {
            query.andWhere("topping.branch_id = :branchId", { branchId });
        }

        if (filters?.status === "active") {
            query.andWhere("topping.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("topping.is_active = false");
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere("LOWER(topping.display_name) LIKE :q", { q });
        }

        if (filters?.category_id) {
            query.innerJoin("topping.categories", "filter_category", "filter_category.id = :categoryId", {
                categoryId: filters.category_id,
            });
        }

        return query;
    }

    private async loadByIds(
        ids: string[],
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<Topping[]> {
        if (ids.length === 0) return [];

        const toppingRepository = getRepository(Topping);
        const items = await toppingRepository
            .createQueryBuilder("topping")
            .leftJoinAndSelect("topping.categories", "category")
            .where("topping.id IN (:...ids)", { ids })
            .andWhere(branchId ? "topping.branch_id = :branchId" : "1=1", branchId ? { branchId } : {})
            .orderBy("topping.create_date", createdSortToOrder(sortCreated))
            .addOrderBy("category.display_name", "ASC")
            .getMany();

        const orderMap = new Map(ids.map((id, index) => [id, index]));
        return items.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive"; category_id?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Topping[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const query = this.createBaseQuery(filters, branchId);
        const total = await query.clone().getCount();
        const ids = await query
            .clone()
            .select("topping.id", "id")
            .orderBy("topping.create_date", createdSortToOrder(sortCreated))
            .skip((safePage - 1) * safeLimit)
            .take(safeLimit)
            .getRawMany<{ id: string }>();
        const data = await this.loadByIds(ids.map((item) => item.id), branchId, sortCreated);
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);

        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findAll(
        branchId?: string,
        sortCreated: CreatedSort = "old",
        filters?: { q?: string; status?: "active" | "inactive"; category_id?: string }
    ): Promise<Topping[]> {
        const ids = await this.createBaseQuery(filters, branchId)
            .select("topping.id", "id")
            .orderBy("topping.create_date", createdSortToOrder(sortCreated))
            .getRawMany<{ id: string }>();

        return this.loadByIds(ids.map((item) => item.id), branchId, sortCreated);
    }

    async findOne(id: string, branchId?: string): Promise<Topping | null> {
        const toppingRepository = getRepository(Topping);
        const query = toppingRepository
            .createQueryBuilder("topping")
            .leftJoinAndSelect("topping.categories", "category")
            .where("topping.id = :id", { id });

        if (branchId) {
            query.andWhere("topping.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(name: string, branchId?: string): Promise<Topping | null> {
        const normalizedName = name.trim().toLowerCase();
        const toppingRepository = getRepository(Topping);
        const query = toppingRepository
            .createQueryBuilder("topping")
            .leftJoinAndSelect("topping.categories", "category")
            .where("LOWER(TRIM(topping.display_name)) = :name", { name: normalizedName });

        if (branchId) {
            query.andWhere("topping.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<Topping>): Promise<Topping> {
        const toppingRepository = getRepository(Topping);
        const entity = toppingRepository.create(data);
        const saved = await toppingRepository.save(entity);
        const created = await this.findOne(saved.id, saved.branch_id);
        if (!created) {
            throw new Error("Topping not found after create");
        }
        return created;
    }

    async update(id: string, data: Partial<Topping>, branchId?: string): Promise<Topping> {
        const toppingRepository = getRepository(Topping);
        const existing = await this.findOne(id, branchId);
        if (!existing) {
            throw new Error("Topping not found");
        }

        toppingRepository.merge(existing, data);
        await toppingRepository.save(existing);

        const updatedTopping = await this.findOne(id, branchId);
        if (!updatedTopping) {
            throw new Error("Topping not found after update");
        }

        return updatedTopping;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const toppingRepository = getRepository(Topping);
        if (branchId) {
            await toppingRepository.delete({ id, branch_id: branchId } as any);
        } else {
            await toppingRepository.delete(id);
        }
    }
}
