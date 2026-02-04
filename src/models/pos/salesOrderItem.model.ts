import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { getRepository } from "../../database/dbContext";

export class SalesOrderItemModels {
    async findAll(branchId?: string): Promise<SalesOrderItem[]> {
        try {
            const salesOrderItemRepository = getRepository(SalesOrderItem);
            const query = salesOrderItemRepository
                .createQueryBuilder("item")
                .leftJoinAndSelect("item.order", "order")
                .leftJoinAndSelect("item.product", "product")
                .leftJoinAndSelect("item.details", "details")
                .orderBy("item.id", "ASC");

            if (branchId) {
                query.andWhere("order.branch_id = :branchId", { branchId });
            }

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<SalesOrderItem | null> {
        try {
            const salesOrderItemRepository = getRepository(SalesOrderItem);
            const query = salesOrderItemRepository
                .createQueryBuilder("item")
                .leftJoinAndSelect("item.order", "order")
                .leftJoinAndSelect("item.product", "product")
                .leftJoinAndSelect("item.details", "details")
                .where("item.id = :id", { id });

            if (branchId) {
                query.andWhere("order.branch_id = :branchId", { branchId });
            }

            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async create(data: SalesOrderItem): Promise<SalesOrderItem> {
        try {
            return getRepository(SalesOrderItem).save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Partial<SalesOrderItem>, branchId?: string): Promise<SalesOrderItem> {
        try {
            if (branchId) {
                const existing = await this.findOne(id, branchId);
                if (!existing) {
                    throw new Error("Item not found");
                }
            }

            await getRepository(SalesOrderItem).update(id, data)
            const updatedItem = await this.findOne(id, branchId)
            if (!updatedItem) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการค้นหา")
            }
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            if (branchId) {
                const existing = await this.findOne(id, branchId);
                if (!existing) {
                    throw new Error("Item not found");
                }
            }

            await getRepository(SalesOrderItem).delete(id)
        } catch (error) {
            throw error
        }
    }
}
