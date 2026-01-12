import { AppDataSource } from "../../database/database";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";

export class ProductsUnitModels {
    private productsUnitRepository = AppDataSource.getRepository(ProductsUnit)

    async findAll(): Promise<ProductsUnit[]> {
        try {
            return this.productsUnitRepository.find({
                order: {
                    create_date: "ASC"
                }
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<ProductsUnit | null> {
        try {
            return this.productsUnitRepository.findOne({
                where: { id }
            })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(name: string): Promise<ProductsUnit | null> {
        try {
            return this.productsUnitRepository.findOne({
                where: { unit_name: name }
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: Partial<ProductsUnit>): Promise<ProductsUnit> {
        try {
            const entity = this.productsUnitRepository.create(data);
            return this.productsUnitRepository.save(entity);
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Partial<ProductsUnit>): Promise<ProductsUnit | null> {
        try {
            await this.productsUnitRepository.update(id, data);
            return this.findOne(id);
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.productsUnitRepository.delete(id);
        } catch (error) {
            throw error
        }
    }
}