import { IngredientsUnit } from "../../entity/stock/IngredientsUnit";
import { getRepository } from "../../database/dbContext";

export class IngredientsUnitModel {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { is_active?: boolean; q?: string },
        branchId?: string
    ): Promise<{ data: IngredientsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        try {
            const safePage = Math.max(page, 1);
            const safeLimit = Math.min(Math.max(limit, 1), 200);
            const ingredientsUnitRepository = getRepository(IngredientsUnit);
            const query = ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                .orderBy("ingredientsUnit.create_date", "ASC");

            if (branchId) {
                query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
            }

            if (filters?.is_active !== undefined) {
                query.andWhere("ingredientsUnit.is_active = :is_active", { is_active: filters.is_active });
            }

            if (filters?.q?.trim()) {
                const q = `%${filters.q.trim().toLowerCase()}%`;
                query.andWhere(
                    "(LOWER(ingredientsUnit.display_name) LIKE :q OR LOWER(ingredientsUnit.unit_name) LIKE :q)",
                    { q }
                );
            }

            query.addOrderBy("ingredientsUnit.is_active", "DESC");
            query.skip((safePage - 1) * safeLimit).take(safeLimit);
            const [data, total] = await query.getManyAndCount();
            const last_page = Math.max(Math.ceil(total / safeLimit), 1);
            return { data, total, page: safePage, limit: safeLimit, last_page };
        } catch (error) {
            throw error;
        }
    }

    async findAll(filters?: { is_active?: boolean }, branchId?: string): Promise<IngredientsUnit[]> {
        try {
            const ingredientsUnitRepository = getRepository(IngredientsUnit);
            const query = ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                .orderBy("ingredientsUnit.create_date", "ASC");

            // Filter by branch for data isolation
            if (branchId) {
                query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
            }

            if (filters?.is_active !== undefined) {
                query.andWhere("ingredientsUnit.is_active = :is_active", { is_active: filters.is_active });
            }

            // Secondary sort
            query.addOrderBy("ingredientsUnit.is_active", "DESC");

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<IngredientsUnit | null> {
        try {
            const ingredientsUnitRepository = getRepository(IngredientsUnit);
            const query = ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                .where("ingredientsUnit.id = :id", { id });
            
            if (branchId) {
                query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
            }
            
            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async findOneByUnitName(unit_name: string, branchId?: string): Promise<IngredientsUnit | null> {
        try {
            const ingredientsUnitRepository = getRepository(IngredientsUnit);
            const query = ingredientsUnitRepository.createQueryBuilder("ingredientsUnit")
                .where("ingredientsUnit.unit_name = :unit_name", { unit_name });
            
            if (branchId) {
                query.andWhere("ingredientsUnit.branch_id = :branchId", { branchId });
            }
            
            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async create(ingredientsUnit: IngredientsUnit): Promise<IngredientsUnit> {
        try {
            return getRepository(IngredientsUnit).save(ingredientsUnit)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredientsUnit: IngredientsUnit, branchId?: string): Promise<IngredientsUnit> {
        try {
            return getRepository(IngredientsUnit).save({ ...ingredientsUnit, id, ...(branchId ? { branch_id: branchId } : {}) } as any)
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const ingredientsUnitRepository = getRepository(IngredientsUnit);
            if (branchId) {
                await ingredientsUnitRepository.delete({ id, branch_id: branchId } as any)
            } else {
                await ingredientsUnitRepository.delete(id)
            }
        } catch (error) {
            throw error
        }
    }
}
