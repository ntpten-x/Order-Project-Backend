import { AppDataSource } from "../../database/database";
import { Ingredients } from "../../entity/stock/Ingredients";
import { addBooleanFilter } from "../../utils/dbHelpers";

/**
 * Ingredients Model
 * Following supabase-postgres-best-practices:
 * - Uses dbHelpers for consistent query patterns
 * - Optimized queries with proper joins
 * - Branch-based data isolation support
 */
export class IngredientsModel {
    private ingredientsRepository = AppDataSource.getRepository(Ingredients)

    async findAll(filters?: { is_active?: boolean }, branchId?: string): Promise<Ingredients[]> {
        let query = this.ingredientsRepository.createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .orderBy("ingredients.create_date", "ASC");

        // Filter by branch for data isolation
        if (branchId) {
            query.andWhere("ingredients.branch_id = :branchId", { branchId });
        }

        // Use dbHelpers for consistent filtering
        query = addBooleanFilter(query, filters?.is_active, "is_active", "ingredients");

        // Secondary sort for consistent ordering when active ones are mixed
        query.addOrderBy("ingredients.is_active", "DESC");

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<Ingredients | null> {
        try {
            const query = this.ingredientsRepository.createQueryBuilder("ingredients")
                .leftJoinAndSelect("ingredients.unit", "unit")
                .where("ingredients.id = :id", { id });
            
            if (branchId) {
                query.andWhere("ingredients.branch_id = :branchId", { branchId });
            }
            
            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async findOneByName(ingredient_name: string, branchId?: string): Promise<Ingredients | null> {
        try {
            const query = this.ingredientsRepository.createQueryBuilder("ingredients")
                .leftJoinAndSelect("ingredients.unit", "unit")
                .where("ingredients.ingredient_name = :ingredient_name", { ingredient_name });
            
            if (branchId) {
                query.andWhere("ingredients.branch_id = :branchId", { branchId });
            }
            
            return query.getOne();
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
