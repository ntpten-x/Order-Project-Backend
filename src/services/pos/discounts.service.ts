import { DiscountsModels } from "../../models/pos/discounts.model";
import { SocketService } from "../socket.service";
import { Discounts } from "../../entity/pos/Discounts";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";

export class DiscountsService {
    private socketService = SocketService.getInstance();

    constructor(private discountsModel: DiscountsModels) { }

    async findAll(q?: string, branchId?: string, sortCreated: CreatedSort = "old"): Promise<Discounts[]> {
        try {
            return this.discountsModel.findAll(q, branchId, sortCreated)
        } catch (error) {
            throw error
        }
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive"; type?: string },
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Discounts[]; total: number; page: number; limit: number; last_page: number }> {
        try {
            return this.discountsModel.findAllPaginated(page, limit, filters, branchId, sortCreated);
        } catch (error) {
            throw error;
        }
    }

    async findOne(id: string, branchId?: string): Promise<Discounts | null> {
        try {
            return this.discountsModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(discount_name: string, branchId?: string): Promise<Discounts | null> {
        try {
            return this.discountsModel.findOneByName(discount_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(discounts: Discounts, branchId?: string): Promise<Discounts> {
        try {
            if (!discounts.discount_name) {
                throw new Error("กรุณาระบุชื่อส่วนลด")
            }

            const effectiveBranchId = branchId || discounts.branch_id;
            if (effectiveBranchId) {
                discounts.branch_id = effectiveBranchId;
            }

            const existingDiscount = await this.discountsModel.findOneByName(discounts.discount_name, effectiveBranchId)
            if (existingDiscount) {
                throw new Error("ชื่อส่วนลดนี้มีอยู่ในระบบแล้ว")
            }

            const createdDiscount = await this.discountsModel.create(discounts)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.create, createdDiscount)
            }
            return createdDiscount
        } catch (error) {
            throw error
        }
    }

    async update(id: string, discounts: Discounts, branchId?: string): Promise<Discounts> {
        try {
            const discountToUpdate = await this.discountsModel.findOne(id, branchId)
            if (!discountToUpdate) {
                throw new Error("ไม่พบข้อมูลส่วนลดที่ต้องการแก้ไข")
            }

            if (discounts.discount_name && discounts.discount_name !== discountToUpdate.discount_name) {
                const effectiveBranchId = branchId || discountToUpdate.branch_id || discounts.branch_id;
                if (effectiveBranchId) {
                    discounts.branch_id = effectiveBranchId;
                }
                const existingDiscount = await this.discountsModel.findOneByName(discounts.discount_name, effectiveBranchId)
                if (existingDiscount) {
                    throw new Error("ชื่อส่วนลดนี้มีอยู่ในระบบแล้ว")
                }
            }

            const effectiveBranchId = branchId || discountToUpdate.branch_id || discounts.branch_id;
            if (effectiveBranchId) {
                discounts.branch_id = effectiveBranchId;
            }

            const updatedDiscount = await this.discountsModel.update(id, discounts, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.update, updatedDiscount)
            }
            return updatedDiscount
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.discountsModel.findOne(id, branchId);
            if (!existing) throw new Error("Discount not found");

            const effectiveBranchId = branchId || existing.branch_id;
            await this.discountsModel.delete(id, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.discounts.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
