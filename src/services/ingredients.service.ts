import { Ingredients } from "../entity/Ingredients";
import { IngredientsModel } from "../models/ingredients.model";
import { SocketService } from "./socket.service";

export class IngredientsService {
    private socketService = SocketService.getInstance();

    constructor(private ingredientsModel: IngredientsModel) { }

    async findAll(filters?: { is_active?: boolean }): Promise<Ingredients[]> {
        try {
            return this.ingredientsModel.findAll(filters)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Ingredients | null> {
        try {
            return this.ingredientsModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(ingredient_name: string): Promise<Ingredients | null> {
        try {
            return this.ingredientsModel.findOneByName(ingredient_name)
        } catch (error) {
            throw error
        }
    }

    async create(ingredients: Ingredients): Promise<Ingredients> {
        try {
            // @ts-ignore
            const savedIngredients = await this.ingredientsModel.create(ingredients)
            const createdIngredients = await this.ingredientsModel.findOne(savedIngredients.id)
            if (createdIngredients) {
                this.socketService.emit('ingredients:create', createdIngredients)
                return createdIngredients
            }
            return savedIngredients
        } catch (error) {
            throw error
        }
    }

    async update(id: string, ingredients: Ingredients): Promise<Ingredients> {
        try {
            await this.ingredientsModel.update(id, ingredients)
            const updatedIngredients = await this.ingredientsModel.findOne(id)
            if (updatedIngredients) {
                this.socketService.emit('ingredients:update', updatedIngredients)
                return updatedIngredients
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตวัตถุดิบ")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.ingredientsModel.delete(id)
            this.socketService.emit('ingredients:delete', { id })
        } catch (error) {
            throw error
        }
    }
}
