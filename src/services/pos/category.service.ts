import { CategoryModels } from "../../models/pos/category.model";
import { SocketService } from "../socket.service";
import { Category } from "../../entity/pos/Category";

export class CategoryService {
    private socketService = SocketService.getInstance();
    constructor(private categoryModel: CategoryModels) { }

    async findAll(): Promise<Category[]> {
        try {
            return this.categoryModel.findAll()
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Category | null> {
        try {
            return this.categoryModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(category_name: string): Promise<Category | null> {
        try {
            return this.categoryModel.findOneByName(category_name)
        } catch (error) {
            throw error
        }
    }

    async create(category: Category): Promise<Category> {
        try {
            const savedCategory = await this.categoryModel.create(category)
            const createdCategory = await this.categoryModel.findOne(savedCategory.id)
            if (createdCategory) {
                this.socketService.emit('category:create', createdCategory)
                return createdCategory
            }
            return savedCategory
        } catch (error) {
            throw error
        }
    }

    async update(id: string, category: Category): Promise<Category> {
        try {
            await this.categoryModel.update(id, category)
            const updatedCategory = await this.categoryModel.findOne(id)
            if (updatedCategory) {
                this.socketService.emit('category:update', updatedCategory)
                return updatedCategory
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตหมวดหมู่สินค้า")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.categoryModel.delete(id)
            this.socketService.emit('category:delete', { id })
        } catch (error) {
            throw error
        }
    }

}