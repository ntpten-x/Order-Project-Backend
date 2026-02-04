import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";
import { getRepository } from "../../database/dbContext";

export class SalesOrderDetailModels {
    async findAll(branchId?: string): Promise<SalesOrderDetail[]> {
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

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<SalesOrderDetail | null> {
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

    async update(id: string, data: SalesOrderDetail, branchId?: string): Promise<SalesOrderDetail> {
        try {
            if (branchId) {
                const existing = await this.findOne(id, branchId);
                if (!existing) throw new Error("Detail not found");
            }

            await getRepository(SalesOrderDetail).update(id, data)
            const updatedDetail = await this.findOne(id, branchId)
            if (!updatedDetail) {
                throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมของสินค้าที่ต้องการค้นหา")
            }
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            if (branchId) {
                const existing = await this.findOne(id, branchId);
                if (!existing) throw new Error("Detail not found");
            }

            await getRepository(SalesOrderDetail).delete(id)
        } catch (error) {
            throw error
        }
    }
}
