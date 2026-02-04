import { Category } from "../../entity/pos/Category";
import { getRepository } from "../../database/dbContext";

export class CategoryModels {
    async findAll(branchId?: string): Promise<Category[]> {
        try {
            const categoryRepository = getRepository(Category);
            const query = categoryRepository.createQueryBuilder("category")
                .orderBy("category.create_date", "ASC");
            
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
