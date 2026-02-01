import { ProductsModels } from "../../models/pos/products.model";
import { SocketService } from "../socket.service";
import { Products } from "../../entity/pos/Products";
import { invalidateCache } from "../../utils/cache";

/**
 * Products Service
 * Note: Caching is handled in ProductsModel
 * This service handles cache invalidation on mutations
 * Branch-based data isolation supported
 */
export class ProductsService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = 'products';

    constructor(private productsModel: ProductsModels) { }

    async findAll(
        page: number,
        limit: number,
        category_id?: string,
        q?: string,
        branchId?: string
    ): Promise<{ data: Products[], total: number, page: number, last_page: number }> {
        // Caching is handled in ProductsModel
        return this.productsModel.findAll(page, limit, category_id, q, undefined, branchId);
    }

    async findOne(id: string, branchId?: string): Promise<Products | null> {
        // Caching is handled in ProductsModel
        return this.productsModel.findOne(id, branchId);
    }

    async findOneByName(product_name: string, branchId?: string): Promise<Products | null> {
        // Caching is handled in ProductsModel
        return this.productsModel.findOneByName(product_name, branchId);
    }

    async create(products: Products): Promise<Products> {
        const savedProducts = await this.productsModel.create(products);
        const createdProducts = await this.productsModel.findOne(savedProducts.id);
        
        if (createdProducts) {
            // Cache invalidation is handled in ProductsModel
            this.socketService.emit('products:create', createdProducts);
            return createdProducts;
        }
        
        return savedProducts;
    }

    async update(id: string, products: Products): Promise<Products> {
        await this.productsModel.update(id, products);
        const updatedProducts = await this.productsModel.findOne(id);
        
        if (updatedProducts) {
            // Cache invalidation is handled in ProductsModel
            this.socketService.emit('products:update', updatedProducts);
            return updatedProducts;
        }
        
        throw new Error("พบข้อผิดพลาดในการอัปเดตสินค้า");
    }

    async delete(id: string): Promise<void> {
        await this.productsModel.delete(id);
        // Cache invalidation is handled in ProductsModel
        this.socketService.emit('products:delete', { id });
    }
}
