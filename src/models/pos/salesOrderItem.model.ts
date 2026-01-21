import { AppDataSource } from "../../database/database";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";

export class SalesOrderItemModels {
    private salesOrderItemRepository = AppDataSource.getRepository(SalesOrderItem)

    async findAll(): Promise<SalesOrderItem[]> {
        try {
            return this.salesOrderItemRepository.find({
                order: {
                    id: "ASC"
                },
                relations: ["order", "product", "details"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<SalesOrderItem | null> {
        try {
            return this.salesOrderItemRepository.findOne({
                where: { id },
                relations: ["order", "product", "details"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: SalesOrderItem): Promise<SalesOrderItem> {
        try {
            return this.salesOrderItemRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Partial<SalesOrderItem>): Promise<SalesOrderItem> {
        try {
            await this.salesOrderItemRepository.update(id, data)
            const updatedItem = await this.findOne(id)
            if (!updatedItem) {
                throw new Error("ไม่พบข้อมูลรายการสินค้าในออเดอร์ที่ต้องการค้นหา")
            }
            return updatedItem
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.salesOrderItemRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
