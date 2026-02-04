import { Delivery } from "../../entity/pos/Delivery";
import { getRepository } from "../../database/dbContext";

export class DeliveryModels {
    async findAll(page: number = 1, limit: number = 50, q?: string, branchId?: string): Promise<{ data: Delivery[], total: number, page: number, last_page: number }> {
        try {
            const skip = (page - 1) * limit;
            const deliveryRepository = getRepository(Delivery);
            const query = deliveryRepository.createQueryBuilder("delivery")
                .orderBy("delivery.create_date", "ASC");

            if (branchId) {
                query.andWhere("delivery.branch_id = :branchId", { branchId });
            }

            if (q && q.trim()) {
                query.andWhere("delivery.delivery_name ILIKE :q", { q: `%${q.trim()}%` });
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

    async findOne(id: string, branchId?: string): Promise<Delivery | null> {
        try {
            const deliveryRepository = getRepository(Delivery);
            const where: any = { id };
            if (branchId) {
                where.branch_id = branchId;
            }
            return deliveryRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(delivery_name: string, branchId?: string): Promise<Delivery | null> {
        try {
            const deliveryRepository = getRepository(Delivery);
            const where: any = { delivery_name };
            if (branchId) {
                where.branch_id = branchId;
            }
            return deliveryRepository.findOneBy(where)
        } catch (error) {
            throw error
        }
    }

    async create(data: Delivery): Promise<Delivery> {
        try {
            return getRepository(Delivery).save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Delivery, branchId?: string): Promise<Delivery> {
        try {
            const deliveryRepository = getRepository(Delivery);
            if (branchId) {
                await deliveryRepository.update({ id, branch_id: branchId } as any, data)
            } else {
                await deliveryRepository.update(id, data)
            }
            const updatedDelivery = await this.findOne(id, branchId)
            if (!updatedDelivery) {
                throw new Error("ไม่พบข้อมูลบริการส่งที่ต้องการค้นหา")
            }
            return updatedDelivery
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const deliveryRepository = getRepository(Delivery);
            if (branchId) {
                await deliveryRepository.delete({ id, branch_id: branchId } as any)
            } else {
                await deliveryRepository.delete(id)
            }
        } catch (error) {
            throw error
        }
    }
}
