import { getRepository } from "../../database/dbContext";
import { IngredientsUnit } from "../../entity/stock/IngredientsUnit";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class IngredientsUnitModel {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { is_active?: boolean; q?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: IngredientsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const ingredientsUnitRepository = getRepository(IngredientsUnit);
        const query = ingredientsUnitRepository
            .createQueryBuilder("ingredientsUnit")
            .orderBy("ingredientsUnit.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
        }

        if (filters?.is_active !== undefined) {
            query.andWhere("ingredientsUnit.is_active = :is_active", { is_active: filters.is_active });
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere("LOWER(ingredientsUnit.display_name) LIKE :q", { q });
        }

        query
            .addOrderBy("ingredientsUnit.is_active", "DESC")
            .addOrderBy("ingredientsUnit.id", "ASC")
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
    ): Promise<IngredientsUnit[]> {
        const ingredientsUnitRepository = getRepository(IngredientsUnit);
        const query = ingredientsUnitRepository
            .createQueryBuilder("ingredientsUnit")
            .orderBy("ingredientsUnit.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
        }

        if (filters?.is_active !== undefined) {
            query.andWhere("ingredientsUnit.is_active = :is_active", { is_active: filters.is_active });
        }

        query.addOrderBy("ingredientsUnit.is_active", "DESC").addOrderBy("ingredientsUnit.id", "ASC");

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<IngredientsUnit | null> {
        const ingredientsUnitRepository = getRepository(IngredientsUnit);
        const query = ingredientsUnitRepository
            .createQueryBuilder("ingredientsUnit")
            .where("ingredientsUnit.id = :id", { id });

        if (branchId) {
            query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByDisplayName(display_name: string, branchId?: string): Promise<IngredientsUnit | null> {
        const ingredientsUnitRepository = getRepository(IngredientsUnit);
        const query = ingredientsUnitRepository
            .createQueryBuilder("ingredientsUnit")
            .where("LOWER(TRIM(ingredientsUnit.display_name)) = :display_name", {
                display_name: display_name.trim().toLowerCase(),
            });

        if (branchId) {
            query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(ingredientsUnit: IngredientsUnit): Promise<IngredientsUnit> {
        return getRepository(IngredientsUnit).save(ingredientsUnit);
    }

    async update(id: string, ingredientsUnit: IngredientsUnit, branchId?: string): Promise<IngredientsUnit> {
        return getRepository(IngredientsUnit).save({
            ...ingredientsUnit,
            id,
            ...(branchId ? { branch_id: branchId } : {}),
        } as IngredientsUnit);
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const ingredientsUnitRepository = getRepository(IngredientsUnit);
        if (branchId) {
            await ingredientsUnitRepository.delete({ id, branch_id: branchId } as any);
            return;
        }

        await ingredientsUnitRepository.delete(id);
    }
}
