import { AppDataSource } from "../database/database";
import { Ingredients } from "../entity/Ingredients";

export class IngredientsModel {
    private ingredientsRepository = AppDataSource.getRepository(Ingredients)

    async findAll(): Promise<Ingredients[]> {
        try {
            return this.ingredientsRepository.createQueryBuilder("ingredients")
                .leftJoinAndSelect("ingredients.unit", "unit")
                .orderBy("ingredients.is_active", "DESC")
                .addOrderBy("ingredients.create_date", "ASC")
                .getMany()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Ingredients | null> {
        try {
            return this.ingredientsRepository.createQueryBuilder("ingredients")
                .leftJoinAndSelect("ingredients.unit", "unit")
                .where("ingredients.id = :id", { id })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async findOneByName(ingredient_name: string): Promise<Ingredients | null> {
        try {
            return this.ingredientsRepository.createQueryBuilder("ingredients")
                .leftJoinAndSelect("ingredients.unit", "unit")
                .where("ingredients.ingredient_name = :ingredient_name", { ingredient_name })
                .getOne()
        } catch (error) {
            throw error
        }
    }

    async create(ingredients: Ingredients): Promise<Ingredients> {
        try {
            return this.ingredientsRepository.save(ingredients)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredients: Ingredients): Promise<Ingredients> {
        try {
            return this.ingredientsRepository.save({ ...ingredients, id })
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ingredientsRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
