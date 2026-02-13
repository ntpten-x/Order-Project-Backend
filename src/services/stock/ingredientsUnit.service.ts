import { IngredientsUnit } from "../../entity/stock/IngredientsUnit";
import { IngredientsUnitModel } from "../../models/stock/ingredientsUnit.model";
import { SocketService } from "../socket.service";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class IngredientsUnitService {
    private socketService = SocketService.getInstance();

    constructor(private ingredientsUnitModel: IngredientsUnitModel) { }

    async findAll(filters?: { is_active?: boolean }, branchId?: string): Promise<IngredientsUnit[]> {
        try {
            return this.ingredientsUnitModel.findAll(filters, branchId)
        } catch (error) {
            throw error
        }
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { is_active?: boolean; q?: string },
        branchId?: string
    ): Promise<{ data: IngredientsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        try {
            return this.ingredientsUnitModel.findAllPaginated(page, limit, filters, branchId);
        } catch (error) {
            throw error;
        }
    }

    async findOne(id: string, branchId?: string): Promise<IngredientsUnit | null> {
        try {
            return this.ingredientsUnitModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByUnitName(unit_name: string, branchId?: string): Promise<IngredientsUnit | null> {
        try {
            return this.ingredientsUnitModel.findOneByUnitName(unit_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(ingredientsUnit: IngredientsUnit, branchId?: string): Promise<IngredientsUnit> {
        try {
            const effectiveBranchId = branchId || ingredientsUnit.branch_id;
            if (effectiveBranchId) {
                ingredientsUnit.branch_id = effectiveBranchId;
            }

            // Check for duplicate name within the same branch
            if (ingredientsUnit.unit_name && effectiveBranchId) {
                const existing = await this.ingredientsUnitModel.findOneByUnitName(ingredientsUnit.unit_name, effectiveBranchId);
                if (existing) {
                    throw new Error("ชื่อหน่วยนับนี้มีอยู่ในระบบแล้ว");
                }
            }
            
            // @ts-ignore - model returns {id} essentially
            const savedIngredientsUnit = await this.ingredientsUnitModel.create(ingredientsUnit)
            const createdIngredientsUnit = await this.ingredientsUnitModel.findOne(savedIngredientsUnit.id, effectiveBranchId)
            if (createdIngredientsUnit) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredientsUnit.create, createdIngredientsUnit)
                }
                return createdIngredientsUnit
            }
            return savedIngredientsUnit
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredientsUnit: IngredientsUnit, branchId?: string): Promise<IngredientsUnit> {
        try {
            const existing = await this.ingredientsUnitModel.findOne(id, branchId);
            if (!existing) throw new Error("Ingredients unit not found");

            const effectiveBranchId = branchId || existing.branch_id || ingredientsUnit.branch_id;
            if (effectiveBranchId) {
                ingredientsUnit.branch_id = effectiveBranchId;
            }

            await this.ingredientsUnitModel.update(id, ingredientsUnit, effectiveBranchId)
            const updatedIngredientsUnit = await this.ingredientsUnitModel.findOne(id, effectiveBranchId)
            if (updatedIngredientsUnit) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredientsUnit.update, updatedIngredientsUnit)
                }
                return updatedIngredientsUnit
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตหน่วยนับวัตถุดิบ")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.ingredientsUnitModel.findOne(id, branchId);
            if (!existing) throw new Error("Ingredients unit not found");

            const effectiveBranchId = branchId || existing.branch_id;
            await this.ingredientsUnitModel.delete(id, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.ingredientsUnit.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}
