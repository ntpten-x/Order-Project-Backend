import { AppDataSource } from "../../database/database";
import { Category } from "../../entity/pos/Category";

export class CategoryModels {
    private categoryRepository = AppDataSource.getRepository(Category)

    async findAll(): Promise<Category[]> {
        try {
            return this.categoryRepository.createQueryBuilder("category").orderBy("category.create_date", "ASC").getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Category | null> {
        try {
            return this.categoryRepository.createQueryBuilder("category").where("category.id = :id", { id }).getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByName(category_name: string): Promise<Category | null> {
        try {
            return this.categoryRepository.createQueryBuilder("category").where("category.category_name = :category_name", { category_name }).getOne()
        } catch (error) {
            throw error
        }
    }

    async create(data: Category): Promise<Category> {
        try {
            return this.categoryRepository.createQueryBuilder("category").insert().values(data).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Category): Promise<Category> {
        try {
            return this.categoryRepository.createQueryBuilder("category").update(data).where("category.id = :id", { id }).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            this.categoryRepository.createQueryBuilder("category").delete().where("category.id = :id", { id }).execute()
        } catch (error) {
            throw error
        }
    }
}