import { AppDataSource } from "../../database/database";
import { Delivery } from "../../entity/pos/Delivery";

export class DeliveryModels {
    private deliveryRepository = AppDataSource.getRepository(Delivery)

    async findAll(): Promise<Delivery[]> {
        try {
            return this.deliveryRepository.find({
                order: {
                    create_date: "ASC"
                }
            })
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Delivery | null> {
        try {
            return this.deliveryRepository.findOneBy({ id })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(delivery_name: string): Promise<Delivery | null> {
        try {
            return this.deliveryRepository.findOneBy({ delivery_name })
        } catch (error) {
            throw error
        }
    }

    async create(data: Delivery): Promise<Delivery> {
        try {
            return this.deliveryRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Delivery): Promise<Delivery> {
        try {
            await this.deliveryRepository.update(id, data)
            const updatedDelivery = await this.findOne(id)
            if (!updatedDelivery) {
                throw new Error("ไม่พบข้อมูลบริการส่งที่ต้องการค้นหา")
            }
            return updatedDelivery
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.deliveryRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
