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
        try {
            const safePage = Math.max(page, 1);
            const safeLimit = Math.min(Math.max(limit, 1), 200);
            const categoryRepository = getRepository(Category);
            const query = categoryRepository.createQueryBuilder("category")
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
                query.andWhere(
                    "(LOWER(category.display_name) LIKE :q OR LOWER(category.category_name) LIKE :q)",
                    { q }
                );
            }

            query.skip((safePage - 1) * safeLimit).take(safeLimit);
            const [data, total] = await query.getManyAndCount();
            const last_page = Math.max(Math.ceil(total / safeLimit), 1);
            return { data, total, page: safePage, limit: safeLimit, last_page };
        } catch (error) {
            throw error;
        }
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<Category[]> {
        try {
            const categoryRepository = getRepository(Category);
            const query = categoryRepository.createQueryBuilder("category")
                .orderBy("category.create_date", createdSortToOrder(sortCreated));

            if (branchId) {
                query.andWhere("category.branch_id = :branchId", { branchId });
            }

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Category | null> {
        try {
            const categoryRepository = getRepository(Category);
            const query = categoryRepository.createQueryBuilder("category")
                .where("category.id = :id", { id });

            if (branchId) {
                query.andWhere("category.branch_id = :branchId", { branchId });
            }

            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async findOneByName(category_name: string, branchId?: string): Promise<Category | null> {
        try {
            const categoryRepository = getRepository(Category);
            const query = categoryRepository.createQueryBuilder("category")
                .where("category.category_name = :category_name", { category_name });

            if (branchId) {
                query.andWhere("category.branch_id = :branchId", { branchId });
            }

            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async create(data: Category): Promise<Category> {
        try {
            const categoryRepository = getRepository(Category);
            return categoryRepository.createQueryBuilder("category").insert().values(data).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Category, branchId?: string): Promise<Category> {
        try {
            const categoryRepository = getRepository(Category);
            const qb = categoryRepository.createQueryBuilder("category")
                .update(data)
                .where("category.id = :id", { id });

            if (branchId) {
                qb.andWhere("category.branch_id = :branchId", { branchId });
            }

            return qb.returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const categoryRepository = getRepository(Category);
            const qb = categoryRepository.createQueryBuilder("category")
                .delete()
                .where("category.id = :id", { id });

            if (branchId) {
                qb.andWhere("category.branch_id = :branchId", { branchId });
            }

            qb.execute()
        } catch (error) {
            throw error
        }
    }
}
