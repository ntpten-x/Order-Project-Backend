import { CategoryModels } from "../../models/pos/category.model";
import { SocketService } from "../socket.service";
import { Category } from "../../entity/pos/Category";

export class CategoryService {
    private socketService = SocketService.getInstance();
    constructor(private categoryModel: CategoryModels) { }

    async findAll(branchId?: string): Promise<Category[]> {
        try {
            return this.categoryModel.findAll(branchId)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string, branchId?: string): Promise<Category | null> {
        try {
            return this.categoryModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(category_name: string, branchId?: string): Promise<Category | null> {
        try {
            return this.categoryModel.findOneByName(category_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(category: Category): Promise<Category> {
        try {
            // Check for duplicate name within the same branch
            if (category.category_name && category.branch_id) {
                const existing = await this.categoryModel.findOneByName(category.category_name, category.branch_id);
                if (existing) {
                    throw new Error("ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว");
                }
            }
            const savedCategory = await this.categoryModel.create(category)
            const createdCategory = await this.categoryModel.findOne(savedCategory.id, category.branch_id)
            if (createdCategory) {
                if (createdCategory.branch_id) {
                    this.socketService.emitToBranch(createdCategory.branch_id, 'category:create', createdCategory)
                }
                return createdCategory
            }
            return savedCategory
        } catch (error) {
            throw error
        }
    }

    async update(id: string, category: Category, branchId?: string): Promise<Category> {
        try {
            await this.categoryModel.update(id, category, branchId || category.branch_id)
            const updatedCategory = await this.categoryModel.findOne(id, branchId || category.branch_id)
            if (updatedCategory) {
                const effectiveBranchId = updatedCategory.branch_id || branchId || category.branch_id;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'category:update', updatedCategory)
            }
            return updatedCategory
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตหมวดหมู่สินค้า")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.categoryModel.findOne(id, branchId);
            if (!existing) {
                throw new Error("Category not found");
            }
            await this.categoryModel.delete(id, branchId)
            const effectiveBranchId = existing.branch_id || branchId;
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, 'category:delete', { id })
            }
        } catch (error) {
            throw error
        }
    }

}
