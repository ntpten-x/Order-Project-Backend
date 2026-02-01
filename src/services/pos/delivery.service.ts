import { DeliveryModels } from "../../models/pos/delivery.model";
import { SocketService } from "../socket.service";
import { Delivery } from "../../entity/pos/Delivery";

export class DeliveryService {
    private socketService = SocketService.getInstance();

    constructor(private deliveryModel: DeliveryModels) { }

    async findAll(page: number, limit: number, q?: string, branchId?: string): Promise<{ data: Delivery[], total: number, page: number, last_page: number }> {
        try {
            return this.deliveryModel.findAll(page, limit, q, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Delivery | null> {
        try {
            return this.deliveryModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(delivery_name: string, branchId?: string): Promise<Delivery | null> {
        try {
            return this.deliveryModel.findOneByName(delivery_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(delivery: Delivery): Promise<Delivery> {
        try {
            if (!delivery.delivery_name) {
                throw new Error("กรุณาระบุชื่อบริการส่ง")
            }

            const existingDelivery = await this.deliveryModel.findOneByName(delivery.delivery_name, delivery.branch_id)
            if (existingDelivery) {
                throw new Error("ชื่อบริการส่งนี้มีอยู่ในระบบแล้ว")
            }

            const createdDelivery = await this.deliveryModel.create(delivery)
            this.socketService.emit('delivery:create', createdDelivery)
            return createdDelivery
        } catch (error) {
            throw error
        }
    }

    async update(id: string, delivery: Delivery): Promise<Delivery> {
        try {
            const deliveryToUpdate = await this.deliveryModel.findOne(id)
            if (!deliveryToUpdate) {
                throw new Error("ไม่พบข้อมูลบริการส่งที่ต้องการแก้ไข")
            }

            if (delivery.delivery_name && delivery.delivery_name !== deliveryToUpdate.delivery_name) {
                const existingDelivery = await this.deliveryModel.findOneByName(delivery.delivery_name, delivery.branch_id || deliveryToUpdate.branch_id)
                if (existingDelivery) {
                    throw new Error("ชื่อบริการส่งนี้มีอยู่ในระบบแล้ว")
                }
            }

            const updatedDelivery = await this.deliveryModel.update(id, delivery)
            this.socketService.emit('delivery:update', updatedDelivery)
            return updatedDelivery
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.deliveryModel.delete(id)
            this.socketService.emit('delivery:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
