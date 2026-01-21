import { AppDataSource } from "../../database/database";
import { SalesOrderDetail } from "../../entity/pos/SalesOrderDetail";

export class SalesOrderDetailModels {
    private salesOrderDetailRepository = AppDataSource.getRepository(SalesOrderDetail)

    async findAll(): Promise<SalesOrderDetail[]> {
        try {
            return this.salesOrderDetailRepository.find({
                order: {
                    create_date: "ASC"
                },
                relations: ["sales_order_item"]
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<SalesOrderDetail | null> {
        try {
            return this.salesOrderDetailRepository.findOne({
                where: { id },
                relations: ["sales_order_item"]
            })
        } catch (error) {
            throw error
        }
    }

    async create(data: SalesOrderDetail): Promise<SalesOrderDetail> {
        try {
            return this.salesOrderDetailRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: SalesOrderDetail): Promise<SalesOrderDetail> {
        try {
            await this.salesOrderDetailRepository.update(id, data)
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
            await this.salesOrderDetailRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
