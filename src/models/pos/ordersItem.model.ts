import { AppDataSource } from "../../database/database";
import { OrdersItem } from "../../entity/pos/OrdersItem";

export class OrdersItemModels {
    private ordersItemRepository = AppDataSource.getRepository(OrdersItem)

    async findAll(): Promise<OrdersItem[]> {
        try {
            return this.ordersItemRepository.find({
                order: {
                    id: "ASC"
                },
                relations: ["order", "product", "details"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<OrdersItem | null> {
        try {
            return this.ordersItemRepository.findOne({
                where: { id },
                relations: ["order", "product", "details"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: OrdersItem): Promise<OrdersItem> {
        try {
            return this.ordersItemRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: OrdersItem): Promise<OrdersItem> {
        try {
            await this.ordersItemRepository.update(id, data)
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
            await this.ordersItemRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
