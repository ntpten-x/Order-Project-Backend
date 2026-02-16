import { Ingredients } from "../../entity/stock/Ingredients";
import { addBooleanFilter } from "../../utils/dbHelpers";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

/**
 * Ingredients Model
 * Following supabase-postgres-best-practices:
 * - Uses dbHelpers for consistent query patterns
 * - Optimized queries with proper joins
 * - Branch-based data isolation support
 */
export class IngredientsModel {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { is_active?: boolean; q?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Ingredients[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const ingredientsRepository = getRepository(Ingredients);
        let query = ingredientsRepository.createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .orderBy("ingredients.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("ingredients.branch_id = :branchId", { branchId });
        }

        query = addBooleanFilter(query, filters?.is_active, "is_active", "ingredients");
        if (filters?.q?.trim()) {
            // Use ILIKE so Postgres can leverage pg_trgm indexes (if present).
            const q = `%${filters.q.trim()}%`;
            query.andWhere(
                "(ingredients.display_name ILIKE :q OR ingredients.ingredient_name ILIKE :q OR COALESCE(ingredients.description, '') ILIKE :q)",
                { q }
            );
        }
        query.addOrderBy("ingredients.is_active", "DESC");
        query.skip((safePage - 1) * safeLimit).take(safeLimit);

        const [data, total] = await query.getManyAndCount();
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);
        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findAll(
        filters?: { is_active?: boolean },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<Ingredients[]> {
        const ingredientsRepository = getRepository(Ingredients);
        let query = ingredientsRepository.createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .orderBy("ingredients.create_date", createdSortToOrder(sortCreated));

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
