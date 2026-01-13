import { AppDataSource } from "../../database/database";
import { OrdersDetail } from "../../entity/pos/OrdersDetail";

export class OrdersDetailModels {
    private ordersDetailRepository = AppDataSource.getRepository(OrdersDetail)

    async findAll(): Promise<OrdersDetail[]> {
        try {
            return this.ordersDetailRepository.find({
                order: {
                    create_date: "ASC"
                },
                relations: ["orders_item"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<OrdersDetail | null> {
        try {
            return this.ordersDetailRepository.findOne({
                where: { id },
                relations: ["orders_item"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: OrdersDetail): Promise<OrdersDetail> {
        try {
            return this.ordersDetailRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: OrdersDetail): Promise<OrdersDetail> {
        try {
            await this.ordersDetailRepository.update(id, data)
            const updatedDetail = await this.findOne(id)
            if (!updatedDetail) {
                throw new Error("ไม่พบข้อมูลรายละเอียดเพิ่มเติมของสินค้าที่ต้องการค้นหา")
            }
            return updatedDetail
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ordersDetailRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
