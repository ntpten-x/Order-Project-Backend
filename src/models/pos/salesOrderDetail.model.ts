import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { getRepository } from "../../database/dbContext";
import { SelectQueryBuilder } from "typeorm";

type AccessContext = {
    scope?: "none" | "own" | "branch" | "all";
    actorUserId?: string;
};

export class SalesOrderDetailModels {
    private applyAccessScope(query: SelectQueryBuilder<SalesOrderDetail>, access?: AccessContext): void {
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

    async findAll(branchId?: string, access?: AccessContext): Promise<SalesOrderDetail[]> {
        try {
            const salesOrderDetailRepository = getRepository(SalesOrderDetail);
            const query = salesOrderDetailRepository
                .createQueryBuilder("detail")
                .leftJoinAndSelect("detail.sales_order_item", "item")
                .leftJoinAndSelect("item.order", "order")
                .orderBy("detail.create_date", "ASC");

            if (branchId) {
                query.andWhere("order.branch_id = :branchId", { branchId });
            }

            this.applyAccessScope(query, access);
            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail | null> {
        try {
            const salesOrderDetailRepository = getRepository(SalesOrderDetail);
            const query = salesOrderDetailRepository
                .createQueryBuilder("detail")
                .leftJoinAndSelect("detail.sales_order_item", "item")
                .leftJoinAndSelect("item.order", "order")
                .where("detail.id = :id", { id });

            if (branchId) {
                query.andWhere("order.branch_id = :branchId", { branchId });
            }

            this.applyAccessScope(query, access);
            return query.getOne();
        } catch (error) {
            throw error
        }
    }

    async create(data: SalesOrderDetail): Promise<SalesOrderDetail> {
        try {
            return getRepository(SalesOrderDetail).save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: SalesOrderDetail, branchId?: string, access?: AccessContext): Promise<SalesOrderDetail> {
        try {
            if (branchId || access?.scope) {
                const existing = await this.findOne(id, branchId, access);
                if (!existing) throw new Error("Detail not found");
            }

            await getRepository(SalesOrderDetail).update(id, data)
            const updatedDetail = await this.findOne(id, branchId, access)
            if (!updatedDetail) {
                throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมของสินค้าที่ต้องการค้นหา")
            }
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string, access?: AccessContext): Promise<void> {
        try {
            if (branchId || access?.scope) {
                const existing = await this.findOne(id, branchId, access);
                if (!existing) throw new Error("Detail not found");
            }

            await getRepository(SalesOrderDetail).delete(id)
        } catch (error) {
            throw error
        }
    }
}
