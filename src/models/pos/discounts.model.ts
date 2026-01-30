import { AppDataSource } from "../../database/database";
import { Discounts } from "../../entity/pos/Discounts";

export class DiscountsModels {
    private discountsRepository = AppDataSource.getRepository(Discounts)

    async findAll(q?: string): Promise<Discounts[]> {
        try {
            const query = this.discountsRepository.createQueryBuilder("discounts")
                .orderBy("discounts.create_date", "ASC");

            if (q && q.trim()) {
                query.where(
                    "(discounts.discount_name ILIKE :q OR discounts.display_name ILIKE :q OR discounts.description ILIKE :q)",
                    { q: `%${q.trim()}%` }
                );
            }

            return query.getMany();
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Discounts | null> {
        try {
            return this.discountsRepository.findOneBy({ id })
        } catch (error) {
            throw error
        }
    }

    async findOneByName(discount_name: string): Promise<Discounts | null> {
        try {
            return this.discountsRepository.findOneBy({ discount_name })
        } catch (error) {
            throw error
        }
    }

    async create(data: Discounts): Promise<Discounts> {
        try {
            return this.discountsRepository.save(data)
        } catch (error) {
            throw error
        }
    }

    async update(id: string, data: Discounts): Promise<Discounts> {
        try {
            await this.discountsRepository.update(id, data)
            const updatedDiscount = await this.findOne(id)
            if (!updatedDiscount) {
                throw new Error("ไม่พบข้อมูลส่วนลดที่ต้องการค้นหา")
            }
            return updatedDiscount
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.discountsRepository.delete(id)
        } catch (error) {
            throw error
        }
    }
}
