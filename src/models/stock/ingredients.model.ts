import { Ingredients } from "../../entity/stock/Ingredients";
import { addBooleanFilter } from "../../utils/dbHelpers";
import { getRepository } from "../../database/dbContext";

/**
 * Ingredients Model
 * Following supabase-postgres-best-practices:
 * - Uses dbHelpers for consistent query patterns
 * - Optimized queries with proper joins
 * - Branch-based data isolation support
 */
export class IngredientsModel {
    async findAll(filters?: { is_active?: boolean }, branchId?: string): Promise<Ingredients[]> {
        const ingredientsRepository = getRepository(Ingredients);
        let query = ingredientsRepository.createQueryBuilder("ingredients")
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
            const ingredientsRepository = getRepository(Ingredients);
            const query = ingredientsRepository.createQueryBuilder("ingredients")
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
            const ingredientsRepository = getRepository(Ingredients);
            const query = ingredientsRepository.createQueryBuilder("ingredients")
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
            return getRepository(Ingredients).save(ingredients)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredients: Ingredients, branchId?: string): Promise<Ingredients> {
        try {
            return getRepository(Ingredients).save({ ...ingredients, id, ...(branchId ? { branch_id: branchId } : {}) } as any)
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const ingredientsRepository = getRepository(Ingredients);
            if (branchId) {
                await ingredientsRepository.delete({ id, branch_id: branchId } as any)
            } else {
                await ingredientsRepository.delete(id)
            }
        } catch (error) {
            throw error
        }
    }
}
