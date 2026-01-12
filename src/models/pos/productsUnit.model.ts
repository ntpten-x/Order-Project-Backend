import { AppDataSource } from "../../database/database";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";

export class ProductsUnitModels {
    private productsUnitRepository = AppDataSource.getRepository(ProductsUnit)

    async findAll(): Promise<ProductsUnit[]> {
        try {
            return this.productsUnitRepository.createQueryBuilder("productsUnit").orderBy("productsUnit.create_date", "ASC").getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<ProductsUnit | null> {
        try {
            return this.productsUnitRepository.createQueryBuilder("productsUnit").where("productsUnit.id = :id", { id }).getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByName(name: string): Promise<ProductsUnit | null> {
        try {
            return this.productsUnitRepository.createQueryBuilder("productsUnit").where("productsUnit.name = :name", { name }).getOne()
        } catch (error) {
            throw error
        }
    }

    async create(data: ProductsUnit): Promise<ProductsUnit> {
        try {
            return this.productsUnitRepository.createQueryBuilder("productsUnit").insert().values(data).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: ProductsUnit): Promise<ProductsUnit> {
        try {
            return this.productsUnitRepository.createQueryBuilder("productsUnit").update(data).where("productsUnit.id = :id", { id }).returning("id").execute().then((result) => result.raw[0])
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            this.productsUnitRepository.createQueryBuilder("productsUnit").delete().where("productsUnit.id = :id", { id }).execute()
        } catch (error) {
            throw error
        }
    }
}