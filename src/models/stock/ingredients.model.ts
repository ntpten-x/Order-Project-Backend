import { getRepository } from "../../database/dbContext";
import { Ingredients } from "../../entity/stock/Ingredients";
import { addBooleanFilter } from "../../utils/dbHelpers";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

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
        let query = ingredientsRepository
            .createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .orderBy("ingredients.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("ingredients.branch_id = :branchId", { branchId });
        }

        query = addBooleanFilter(query, filters?.is_active, "is_active", "ingredients");

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere(
                [
                    "LOWER(ingredients.display_name) LIKE :q",
                    "LOWER(COALESCE(ingredients.description, '')) LIKE :q",
                    "LOWER(COALESCE(unit.display_name, '')) LIKE :q",
                ].join(" OR "),
                { q }
            );
        }

        query
            .addOrderBy("ingredients.is_active", "DESC")
            .addOrderBy("ingredients.id", "ASC")
            .skip((safePage - 1) * safeLimit)
            .take(safeLimit);

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
        let query = ingredientsRepository
            .createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .orderBy("ingredients.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("ingredients.branch_id = :branchId", { branchId });
        }

        query = addBooleanFilter(query, filters?.is_active, "is_active", "ingredients");
        query.addOrderBy("ingredients.is_active", "DESC").addOrderBy("ingredients.id", "ASC");

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<Ingredients | null> {
        const ingredientsRepository = getRepository(Ingredients);
        const query = ingredientsRepository
            .createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .where("ingredients.id = :id", { id });

        if (branchId) {
            query.andWhere("ingredients.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByDisplayName(display_name: string, branchId?: string): Promise<Ingredients | null> {
        const ingredientsRepository = getRepository(Ingredients);
        const query = ingredientsRepository
            .createQueryBuilder("ingredients")
            .leftJoinAndSelect("ingredients.unit", "unit")
            .where("LOWER(TRIM(ingredients.display_name)) = :display_name", {
                display_name: display_name.trim().toLowerCase(),
            });

        if (branchId) {
            query.andWhere("ingredients.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(ingredients: Ingredients): Promise<Ingredients> {
        return getRepository(Ingredients).save(ingredients);
    }

    async update(id: string, ingredients: Ingredients, branchId?: string): Promise<Ingredients> {
        return getRepository(Ingredients).save({
            ...ingredients,
            id,
            ...(branchId ? { branch_id: branchId } : {}),
        } as Ingredients);
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const ingredientsRepository = getRepository(Ingredients);
        if (branchId) {
            await ingredientsRepository.delete({ id, branch_id: branchId } as any);
            return;
        }

        await ingredientsRepository.delete(id);
    }
}
