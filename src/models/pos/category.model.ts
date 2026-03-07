import { Category } from "../../entity/pos/Category";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class CategoryModels {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Category[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const categoryRepository = getRepository(Category);
        const query = categoryRepository
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

        query.skip((safePage - 1) * safeLimit).take(safeLimit);
        const [data, total] = await query.getManyAndCount();
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);

        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<Category[]> {
        const categoryRepository = getRepository(Category);
        const query = categoryRepository
            .createQueryBuilder("category")
            .orderBy("category.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<Category | null> {
        const categoryRepository = getRepository(Category);
        const query = categoryRepository
            .createQueryBuilder("category")
            .where("category.id = :id", { id });

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(name: string, branchId?: string): Promise<Category | null> {
        const normalizedName = name.trim().toLowerCase();
        const categoryRepository = getRepository(Category);
        const query = categoryRepository
            .createQueryBuilder("category")
            .where("LOWER(TRIM(category.display_name)) = :name", { name: normalizedName });

        if (branchId) {
            query.andWhere("category.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<Category>): Promise<Category> {
        const categoryRepository = getRepository(Category);
        const entity = categoryRepository.create(data);
        return categoryRepository.save(entity);
    }

    async update(id: string, data: Partial<Category>, branchId?: string): Promise<Category> {
        const categoryRepository = getRepository(Category);
        if (branchId) {
            await categoryRepository.update({ id, branch_id: branchId } as any, data);
        } else {
            await categoryRepository.update(id, data);
        }

        const updatedCategory = await this.findOne(id, branchId);
        if (!updatedCategory) {
            throw new Error("Category not found after update");
        }

        return updatedCategory;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const categoryRepository = getRepository(Category);
        if (branchId) {
            await categoryRepository.delete({ id, branch_id: branchId } as any);
        } else {
            await categoryRepository.delete(id);
        }
    }
}
