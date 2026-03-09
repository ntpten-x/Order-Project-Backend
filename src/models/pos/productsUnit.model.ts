import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { getRepository } from "../../database/dbContext";
import { CreatedSort, createdSortToOrder } from "../../utils/sortCreated";

export class ProductsUnitModels {
    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: ProductsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        const safePage = Math.max(page, 1);
        const safeLimit = Math.min(Math.max(limit, 1), 200);
        const productsUnitRepository = getRepository(ProductsUnit);
        const query = productsUnitRepository
            .createQueryBuilder("productsUnit")
            .orderBy("productsUnit.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("productsUnit.branch_id = :branchId", { branchId });
        }

        if (filters?.status === "active") {
            query.andWhere("productsUnit.is_active = true");
        } else if (filters?.status === "inactive") {
            query.andWhere("productsUnit.is_active = false");
        }

        if (filters?.q?.trim()) {
            const q = `%${filters.q.trim().toLowerCase()}%`;
            query.andWhere("LOWER(productsUnit.display_name) LIKE :q", { q });
        }

        query.skip((safePage - 1) * safeLimit).take(safeLimit);
        const [data, total] = await query.getManyAndCount();
        const last_page = Math.max(Math.ceil(total / safeLimit), 1);

        return { data, total, page: safePage, limit: safeLimit, last_page };
    }

    async findAll(branchId?: string, sortCreated: CreatedSort = "old"): Promise<ProductsUnit[]> {
        const productsUnitRepository = getRepository(ProductsUnit);
        const query = productsUnitRepository
            .createQueryBuilder("productsUnit")
            .orderBy("productsUnit.create_date", createdSortToOrder(sortCreated));

        if (branchId) {
            query.andWhere("productsUnit.branch_id = :branchId", { branchId });
        }

        return query.getMany();
    }

    async findOne(id: string, branchId?: string): Promise<ProductsUnit | null> {
        const productsUnitRepository = getRepository(ProductsUnit);
        const query = productsUnitRepository
            .createQueryBuilder("productsUnit")
            .where("productsUnit.id = :id", { id });

        if (branchId) {
            query.andWhere("productsUnit.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async findOneByName(name: string, branchId?: string): Promise<ProductsUnit | null> {
        const normalizedName = name.trim().toLowerCase();
        const productsUnitRepository = getRepository(ProductsUnit);
        const query = productsUnitRepository
            .createQueryBuilder("productsUnit")
            .where("LOWER(TRIM(productsUnit.display_name)) = :name", { name: normalizedName });

        if (branchId) {
            query.andWhere("productsUnit.branch_id = :branchId", { branchId });
        }

        return query.getOne();
    }

    async create(data: Partial<ProductsUnit>): Promise<ProductsUnit> {
        const productsUnitRepository = getRepository(ProductsUnit);
        const entity = productsUnitRepository.create(data);
        return productsUnitRepository.save(entity);
    }

    async update(id: string, data: Partial<ProductsUnit>, branchId?: string): Promise<ProductsUnit> {
        const productsUnitRepository = getRepository(ProductsUnit);
        if (branchId) {
            await productsUnitRepository.update({ id, branch_id: branchId } as any, data);
        } else {
            await productsUnitRepository.update(id, data);
        }

        const updatedProductsUnit = await this.findOne(id, branchId);
        if (!updatedProductsUnit) {
            throw new Error("Products unit not found after update");
        }

        return updatedProductsUnit;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const productsUnitRepository = getRepository(ProductsUnit);
        if (branchId) {
            await productsUnitRepository.delete({ id, branch_id: branchId } as any);
        } else {
            await productsUnitRepository.delete(id);
        }
    }
}
