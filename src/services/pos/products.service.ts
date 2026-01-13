import { ProductsModels } from "../../models/pos/products.model";
import { SocketService } from "../socket.service";
import { Products } from "../../entity/pos/Products";

export class ProductsService {
    private socketService = SocketService.getInstance();

    constructor(private productsModel: ProductsModels) { }

    async findAll(page: number, limit: number): Promise<{ data: Products[], total: number, page: number, last_page: number }> {
        try {
            return this.productsModel.findAll(page, limit)
        } catch (error) {
            throw error
        }
    }

    async findOne(id: string): Promise<Products | null> {
        try {
            return this.productsModel.findOne(id)
        } catch (error) {
            throw error
        }
    }

    async findOneByName(product_name: string): Promise<Products | null> {
        try {
            return this.productsModel.findOneByName(product_name)
        } catch (error) {
            throw error
        }
    }

    async create(products: Products): Promise<Products> {
        try {
            // @ts-ignore
            const savedProducts = await this.productsModel.create(products)
            const createdProducts = await this.productsModel.findOne(savedProducts.id)
            if (createdProducts) {
                this.socketService.emit('products:create', createdProducts)
                return createdProducts
            }
            return savedProducts
        } catch (error) {
            throw error
        }
    }

    async update(id: string, products: Products): Promise<Products> {
        try {
            await this.productsModel.update(id, products)
            const updatedProducts = await this.productsModel.findOne(id)
            if (updatedProducts) {
                this.socketService.emit('products:update', updatedProducts)
                return updatedProducts
            }
            throw new Error("พบข้อผิดพลาดในการอัปเดตสินค้า")
        } catch (error) {
            throw error
        }
    }

    async delete(id: string): Promise<void> {
        try {
            await this.productsModel.delete(id)
            this.socketService.emit('products:delete', { id })
        } catch (error) {
            throw error
        }
    }
}