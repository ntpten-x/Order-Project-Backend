import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { getRepository } from "../../database/dbContext";

export class ProductsUnitModels {
    async findAll(branchId?: string): Promise<ProductsUnit[]> {
        try {
            const productsUnitRepository = getRepository(ProductsUnit);
            const where: any = {};
            if (branchId) {
                where.branch_id = branchId;
            }
            return productsUnitRepository.find({
                where,
                order: {
                    create_date: "ASC"
                }
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<ProductsUnit | null> {
        try {
            const productsUnitRepository = getRepository(ProductsUnit);
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }
            return productsUnitRepository.findOne({
                where
            })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(name: string, branchId?: string): Promise<ProductsUnit | null> {
        try {
            const productsUnitRepository = getRepository(ProductsUnit);
            const where: any = { unit_name: name };
            if (branchId) {
                where.branch_id = branchId;
            }
            return productsUnitRepository.findOne({
                where
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: Partial<ProductsUnit>): Promise<ProductsUnit> {
        try {
            const productsUnitRepository = getRepository(ProductsUnit);
            const entity = productsUnitRepository.create(data);
            return productsUnitRepository.save(entity);
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Partial<ProductsUnit>, branchId?: string): Promise<ProductsUnit | null> {
        try {
            const productsUnitRepository = getRepository(ProductsUnit);
            if (branchId) {
                await productsUnitRepository.update({ id, branch_id: branchId } as any, data);
            } else {
                await productsUnitRepository.update(id, data);
            }
            return this.findOne(id, branchId);
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const productsUnitRepository = getRepository(ProductsUnit);
            if (branchId) {
                await productsUnitRepository.delete({ id, branch_id: branchId } as any);
            } else {
                await productsUnitRepository.delete(id);
            }
        } catch (error) {
            throw error
        }
    }
}
