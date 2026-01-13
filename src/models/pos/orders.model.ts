import { AppDataSource } from "../../database/database";
import { Orders } from "../../entity/pos/Orders";

export class OrdersModels {
    private ordersRepository = AppDataSource.getRepository(Orders)

    async findAll(): Promise<Orders[]> {
        try {
            return this.ordersRepository.find({
                order: {
                    create_date: "DESC"
                },
                relations: ["table", "delivery", "discount", "created_by"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Orders | null> {
        try {
            return this.ordersRepository.findOne({
                where: { id },
                relations: ["table", "delivery", "discount", "created_by", "items", "items.product", "items.details", "payments"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOneByOrderNo(order_no: string): Promise<Orders | null> {
        try {
            return this.ordersRepository.findOne({
                where: { order_no },
                relations: ["table", "delivery", "discount", "created_by"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: Orders): Promise<Orders> {
        try {
            return this.ordersRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Orders): Promise<Orders> {
        try {
            await this.ordersRepository.update(id, data)
            const updatedOrder = await this.findOne(id)
            if (!updatedOrder) {
                throw new Error("ไม่พบข้อมูลออเดอร์ที่ต้องการค้นหา")
            }
            return updatedOrder
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ordersRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
