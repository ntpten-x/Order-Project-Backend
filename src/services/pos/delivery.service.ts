import { DeliveryModels } from "../../models/pos/delivery.model";
import { SocketService } from "../socket.service";
import { Delivery } from "../../entity/pos/Delivery";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";

export class DeliveryService {
    private socketService = SocketService.getInstance();

    constructor(private deliveryModel: DeliveryModels) { }

    async findAll(
        page: number,
        limit: number,
        q?: string,
        branchId?: string,
        sortCreated: CreatedSort = "old",
        status?: "active" | "inactive"
    ): Promise<{ data: Delivery[], total: number, page: number, last_page: number }> {
        try {
            return this.deliveryModel.findAll(page, limit, q, branchId, sortCreated, status)
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
            if (createdDelivery.branch_id) {
                this.socketService.emitToBranch(createdDelivery.branch_id, RealtimeEvents.delivery.create, createdDelivery)
            }
            return createdDelivery
        } catch (error) {
            throw error
        }
    }

    async update(id: string, delivery: Delivery, branchId?: string): Promise<Delivery> {
        try {
            const deliveryToUpdate = await this.deliveryModel.findOne(id, branchId)
            if (!deliveryToUpdate) {
                throw new Error("ไม่พบข้อมูลบริการส่งที่ต้องการแก้ไข")
            }

            if (delivery.delivery_name && delivery.delivery_name !== deliveryToUpdate.delivery_name) {
                const existingDelivery = await this.deliveryModel.findOneByName(delivery.delivery_name, delivery.branch_id || deliveryToUpdate.branch_id)
                if (existingDelivery) {
                    throw new Error("ชื่อบริการส่งนี้มีอยู่ในระบบแล้ว")
                }
            }

            const effectiveBranchId = deliveryToUpdate.branch_id || branchId || delivery.branch_id;
            const updatedDelivery = await this.deliveryModel.update(id, delivery, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.delivery.update, updatedDelivery)
            }
            return updatedDelivery
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.deliveryModel.findOne(id, branchId);
            if (!existing) throw new Error("Delivery not found");
            await this.deliveryModel.delete(id, branchId)
            const effectiveBranchId = existing.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.delivery.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
