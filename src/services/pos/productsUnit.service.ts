import { ProductsUnitModels } from "../../models/pos/productsUnit.model";
import { SocketService } from "../socket.service";
import { ProductsUnit } from "../../entity/pos/ProductsUnit";

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

    async create(productsUnit: ProductsUnit): Promise<ProductsUnit> {
        try {
            const findProductsUnit = await this.productsUnitModel.findOneByName(productsUnit.unit_name, productsUnit.branch_id)
            if (findProductsUnit) {
                throw new Error("หน่วยนี้มีอยู่ในระบบแล้ว")
            }
            // @ts-ignore
            const savedProductsUnit = await this.productsUnitModel.create(productsUnit)
            const createdProductsUnit = await this.productsUnitModel.findOne(savedProductsUnit.id)
            if (createdProductsUnit) {
                this.socketService.emit('productsUnit:create', createdProductsUnit)
                return createdProductsUnit
            }
            return savedProductsUnit
        } catch (error) {
            throw error
        }
    }

    async update(id: string, productsUnit: ProductsUnit): Promise<ProductsUnit> {
        try {
            const findProductsUnit = await this.productsUnitModel.findOneByName(productsUnit.unit_name, productsUnit.branch_id)
            if (findProductsUnit && findProductsUnit.id !== id) {
                throw new Error("หน่วยนี้มีอยู่ในระบบแล้ว")
            }
            const updatedProductsUnit = await this.productsUnitModel.update(id, productsUnit)
            if (updatedProductsUnit) {
                this.socketService.emit('productsUnit:update', updatedProductsUnit)
                return updatedProductsUnit
            }
            throw new Error("ไม่สามารถอัปเดตข้อมูลได้")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.productsUnitModel.delete(id)
            this.socketService.emit('productsUnit:delete', { id })
        } catch (error) {
            throw error
        }
    }
}   
