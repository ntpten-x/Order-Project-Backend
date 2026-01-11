import { IngredientsUnit } from "../entity/IngredientsUnit";
import { IngredientsUnitModel } from "../models/ingredientsUnit.model";
import { SocketService } from "./socket.service";

export class IngredientsUnitService {
    private socketService = SocketService.getInstance();

    constructor(private ingredientsUnitModel: IngredientsUnitModel) { }

    async findAll(filters?: { is_active?: boolean }): Promise<IngredientsUnit[]> {
        try {
            return this.ingredientsUnitModel.findAll(filters)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<IngredientsUnit | null> {
        try {
            return this.ingredientsUnitModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async findOneByUnitName(unit_name: string): Promise<IngredientsUnit | null> {
        try {
            return this.ingredientsUnitModel.findOneByUnitName(unit_name)
        } catch (error) {
            throw error
        }
    }

    async create(ingredientsUnit: IngredientsUnit): Promise<IngredientsUnit> {
        try {
            // @ts-ignore - model returns {id} essentially
            const savedIngredientsUnit = await this.ingredientsUnitModel.create(ingredientsUnit)
            const createdIngredientsUnit = await this.ingredientsUnitModel.findOne(savedIngredientsUnit.id)
            if (createdIngredientsUnit) {
                this.socketService.emit('ingredientsUnit:create', createdIngredientsUnit)
                return createdIngredientsUnit
            }
            return savedIngredientsUnit
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredientsUnit: IngredientsUnit): Promise<IngredientsUnit> {
        try {
            await this.ingredientsUnitModel.update(id, ingredientsUnit)
            const updatedIngredientsUnit = await this.ingredientsUnitModel.findOne(id)
            if (updatedIngredientsUnit) {
                this.socketService.emit('ingredientsUnit:update', updatedIngredientsUnit)
                return updatedIngredientsUnit
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตหน่วยนับวัตถุดิบ")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ingredientsUnitModel.delete(id)
            this.socketService.emit('ingredientsUnit:delete', { id })
        } catch (error) {
            throw error
        }
    }
}