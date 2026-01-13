import { AppDataSource } from "../../database/database";
import { Discounts } from "../../entity/pos/Discounts";

export class DiscountsModels {
    private discountsRepository = AppDataSource.getRepository(Discounts)

    async findAll(): Promise<Discounts[]> {
        try {
            return this.discountsRepository.find({
                order: {
                    create_date: "ASC"
                }
            })
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
