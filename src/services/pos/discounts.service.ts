import { DiscountsModels } from "../../models/pos/discounts.model";
import { SocketService } from "../socket.service";
import { Discounts } from "../../entity/pos/Discounts";

export class DiscountsService {
    private socketService = SocketService.getInstance();

    constructor(private discountsModel: DiscountsModels) { }

    async findAll(): Promise<Discounts[]> {
        try {
            return this.discountsModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Discounts | null> {
        try {
            return this.discountsModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(discount_name: string): Promise<Discounts | null> {
        try {
            return this.discountsModel.findOneByName(discount_name)
        } catch (error) {
            throw error
        }
    }

    async create(discounts: Discounts): Promise<Discounts> {
        try {
            if (!discounts.discount_name) {
                throw new Error("กรุณาระบุชื่อส่วนลด")
            }

            const existingDiscount = await this.discountsModel.findOneByName(discounts.discount_name)
            if (existingDiscount) {
                throw new Error("ชื่อส่วนลดนี้มีอยู่ในระบบแล้ว")
            }

            const createdDiscount = await this.discountsModel.create(discounts)
            this.socketService.emit('discounts:create', createdDiscount)
            return createdDiscount
        } catch (error) {
            throw error
        }
    }

    async update(id: string, discounts: Discounts): Promise<Discounts> {
        try {
            const discountToUpdate = await this.discountsModel.findOne(id)
            if (!discountToUpdate) {
                throw new Error("ไม่พบข้อมูลส่วนลดที่ต้องการแก้ไข")
            }

            if (discounts.discount_name && discounts.discount_name !== discountToUpdate.discount_name) {
                const existingDiscount = await this.discountsModel.findOneByName(discounts.discount_name)
                if (existingDiscount) {
                    throw new Error("ชื่อส่วนลดนี้มีอยู่ในระบบแล้ว")
                }
            }

            const updatedDiscount = await this.discountsModel.update(id, discounts)
            this.socketService.emit('discounts:update', updatedDiscount)
            return updatedDiscount
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.discountsModel.delete(id)
            this.socketService.emit('discounts:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
