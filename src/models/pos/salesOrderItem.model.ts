import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";
import { getRepository } from "../../database/dbContext";
import { SelectQueryBuilder } from "typeorm";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class SalesOrderItemModels {
    private applyAccessScope(query: SelectQueryBuilder<SalesOrderItem>, access?: AccessContext): void {
        if (access?.scope === "none") {
            query.andWhere("1=0");
            return;
        }

        if (access?.scope === "own") {
            if (!access.actorUserId) {
                query.andWhere("1=0");
                return;
            }
            query.andWhere("order.created_by_id = :actorUserId", { actorUserId: access.actorUserId });
        }
    }

    async findAll(branchId?: string, access?: AccessContext): Promise<SalesOrderItem[]> {
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

            this.applyAccessScope(query, access);
            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrderItem | null> {
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

            this.applyAccessScope(query, access);
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

    async update(id: string, data: Partial<SalesOrderItem>, branchId?: string, access?: AccessContext): Promise<SalesOrderItem> {
        try {
            if (branchId || access?.scope) {
                const existing = await this.findOne(id, branchId, access);
                if (!existing) {
                    throw new Error("Item not found");
                }
            }

            await getRepository(SalesOrderItem).update(id, data)
            const updatedItem = await this.findOne(id, branchId, access)
            if (!updatedItem) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการค้นหา")
            }
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        try {
            if (branchId || access?.scope) {
                const existing = await this.findOne(id, branchId, access);
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
