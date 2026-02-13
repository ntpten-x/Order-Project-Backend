import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { SocketService } from "../socket.service";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class ProductsUnitService {
    private socketService = SocketService.getInstance();

    constructor(private productsUnitModel: ProductsUnitModels) { }

    async findAll(branchId?: string): Promise<ProductsUnit[]> {
        try {
            return this.productsUnitModel.findAll(branchId)
        } catch (error) {
            throw error
        }
    }

    async findAllPaginated(
        page: number,
        limit: number,
        filters?: { q?: string; status?: "active" | "inactive" },
        branchId?: string
    ): Promise<{ data: ProductsUnit[]; total: number; page: number; limit: number; last_page: number }> {
        try {
            return this.productsUnitModel.findAllPaginated(page, limit, filters, branchId);
        } catch (error) {
            throw error;
        }
    }

    async findOne(id: string, branchId?: string): Promise<ProductsUnit | null> {
        try {
            return this.productsUnitModel.findOne(id, branchId)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(products_unit_name: string, branchId?: string): Promise<ProductsUnit | null> {
        try {
            return this.productsUnitModel.findOneByName(products_unit_name, branchId)
        } catch (error) {
            throw error
        }
    }

    async create(productsUnit: ProductsUnit, branchId?: string): Promise<ProductsUnit> {
        try {
            const effectiveBranchId = branchId || productsUnit.branch_id;
            if (effectiveBranchId) {
                productsUnit.branch_id = effectiveBranchId;
            }

            const findProductsUnit = await this.productsUnitModel.findOneByName(productsUnit.unit_name, effectiveBranchId)
            if (findProductsUnit) {
                throw new Error("หน่วยนี้มีอยู่ในระบบแล้ว")
            }
            // @ts-ignore
            const savedProductsUnit = await this.productsUnitModel.create(productsUnit)
            const createdProductsUnit = await this.productsUnitModel.findOne(savedProductsUnit.id, effectiveBranchId)
            if (createdProductsUnit) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.create, createdProductsUnit)
                }
                return createdProductsUnit
            }
            return savedProductsUnit
        } catch (error) {
            throw error
        }
    }

    async update(id: string, productsUnit: ProductsUnit, branchId?: string): Promise<ProductsUnit> {
        try {
            const effectiveBranchId = branchId || productsUnit.branch_id;
            if (effectiveBranchId) {
                productsUnit.branch_id = effectiveBranchId;
            }

            const existingUnit = await this.productsUnitModel.findOne(id, effectiveBranchId)
            if (!existingUnit) {
                throw new Error("Products unit not found")
            }

            const findProductsUnit = await this.productsUnitModel.findOneByName(productsUnit.unit_name, effectiveBranchId)
            if (findProductsUnit && findProductsUnit.id !== id) {
                throw new Error("หน่วยนี้มีอยู่ในระบบแล้ว")
            }
            const updatedProductsUnit = await this.productsUnitModel.update(id, productsUnit, effectiveBranchId)
            if (updatedProductsUnit) {
                if (effectiveBranchId) {
                    this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.update, updatedProductsUnit)
                }
                return updatedProductsUnit
            }
            throw new Error("ไม่สามารถอัปเดตข้อมูลได้")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string, branchId?: string): Promise<void> {
        try {
            const existing = await this.productsUnitModel.findOne(id, branchId);
            if (!existing) throw new Error("Products unit not found");

            const effectiveBranchId = branchId || existing.branch_id;
            await this.productsUnitModel.delete(id, effectiveBranchId)
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.productsUnit.delete, { id })
            }
        } catch (error) {
            throw error
        }
    }
}   
