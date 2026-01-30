import { AppDataSource } from "../../database/database";
import { Delivery } from "../../entity/pos/Delivery";

export class DeliveryModels {
    private deliveryRepository = AppDataSource.getRepository(Delivery)

    async findAll(page: number = 1, limit: number = 50, q?: string): Promise<{ data: Delivery[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;
            const query = this.deliveryRepository.createQueryBuilder("delivery")
                .orderBy("delivery.create_date", "ASC");

            if (q && q.trim()) {
                query.where("delivery.delivery_name ILIKE :q", { q: `%${q.trim()}%` });
            }

            const [data, total] = await query.skip(skip).take(limit).getManyAndCount();
            return {
                data,
                total,
                page,
                last_page: Math.max(1, Math.ceil(total / limit))
            };
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
