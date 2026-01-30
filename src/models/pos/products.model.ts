import { AppDataSource } from "../../database/database";
import { Products } from "../../entity/pos/Products";

export class ProductsModels {
    private productsRepository = AppDataSource.getRepository(Products)

    async findAll(
        page: number = 1,
        limit: number = 50,
        category_id?: string,
        q?: string
    ): Promise<{ data: Products[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;

            const query = this.productsRepository.createQueryBuilder("products")
                .leftJoinAndSelect("products.category", "category")
                .leftJoinAndSelect("products.unit", "unit")
                .orderBy("products.create_date", "ASC");

            if (category_id) {
                query.andWhere("products.category_id = :category_id", { category_id });
            }

            if (q && q.trim()) {
                query.andWhere(
                    "(products.product_name ILIKE :q OR products.display_name ILIKE :q OR products.description ILIKE :q)",
                    { q: `%${q.trim()}%` }
                );
            }

            const [data, total] = await query.skip(skip).take(limit).getManyAndCount();

            return {
                data,
                total,
                page,
                last_page: Math.ceil(total / limit) || 1
            }
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Products | null> {
        try {
            return this.productsRepository.createQueryBuilder("products")
                .leftJoinAndSelect("products.category", "category")
                .leftJoinAndSelect("products.unit", "unit")
                .where("products.id = :id", { id })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByName(product_name: string): Promise<Products | null> {
        try {
            return this.productsRepository.createQueryBuilder("products")
                .leftJoinAndSelect("products.category", "category")
                .leftJoinAndSelect("products.unit", "unit")
                .where("products.product_name = :product_name", { product_name })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async create(data: Products): Promise<Products> {
        try {
            return this.productsRepository.createQueryBuilder("products").insert().values(data).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Products): Promise<Products> {
        try {
            return this.productsRepository.createQueryBuilder("products").update(data).where("products.id = :id", { id }).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            this.productsRepository.createQueryBuilder("products").delete().where("products.id = :id", { id }).execute()
        } catch (error) {
            throw error
        }
    }
}
