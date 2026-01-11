import { AppDataSource } from "../../database/database";
import { IngredientsUnit } from "../../entity/stock/IngredientsUnit";

export class IngredientsUnitModel {
    private ingredientsUnitRepository = AppDataSource.getRepository(IngredientsUnit)

    async findAll(filters?: { is_active?: boolean }): Promise<IngredientsUnit[]> {
        try {
            const query = this.ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                // .leftJoinAndSelect("ingredientsUnit.ingredients", "ingredients")
                .orderBy("ingredientsUnit.create_date", "ASC")

            if (filters?.is_active !== undefined) {
                query.andWhere("ingredientsUnit.is_active = :is_active", { is_active: filters.is_active })
            }

            // Secondary sort
            query.addOrderBy("ingredientsUnit.is_active", "DESC")

            return query.getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<IngredientsUnit | null> {
        try {
            return this.ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                // .leftJoinAndSelect("ingredientsUnit.ingredients", "ingredients")
                .where("ingredientsUnit.id = :id", { id })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByUnitName(unit_name: string): Promise<IngredientsUnit | null> {
        try {
            return this.ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                // .leftJoinAndSelect("ingredientsUnit.ingredients", "ingredients")
                .where("ingredientsUnit.unit_name = :unit_name", { unit_name })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async create(ingredientsUnit: IngredientsUnit): Promise<IngredientsUnit> {
        try {
            return this.ingredientsUnitRepository.save(ingredientsUnit)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredientsUnit: IngredientsUnit): Promise<IngredientsUnit> {
        try {
            return this.ingredientsUnitRepository.save({ ...ingredientsUnit, id })
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ingredientsUnitRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}