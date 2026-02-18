import { ProductsModels } from "../../models/pos/products.model";
import { SocketService } from "../socket.service";
import { Products } from "../../entity/pos/Products";
import { invalidateCache } from "../../utils/cache";
import { AppError } from "../../utils/AppError";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";

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
        is_active?: boolean,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Products[], total: number, page: number, last_page: number }> {
        // Caching is handled in ProductsModel
        return this.productsModel.findAll(page, limit, category_id, q, is_active, branchId, sortCreated);
    }

    async countActive(category_id?: string, branchId?: string): Promise<number> {
        return this.productsModel.countActive(category_id, branchId);
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
        const createdProducts = await this.productsModel.findOne(savedProducts.id, products.branch_id);

        if (createdProducts) {
            // Cache invalidation is handled in ProductsModel
            if (createdProducts.branch_id) {
                this.socketService.emitToBranch(createdProducts.branch_id, RealtimeEvents.products.create, createdProducts);
            }
            return createdProducts;
        }

        return savedProducts;
    }

    async update(id: string, products: Products, branchId?: string): Promise<Products> {
        const effectiveBranchId = branchId || products.branch_id;
        await this.productsModel.update(id, products, effectiveBranchId);
        const updatedProducts = await this.productsModel.findOne(id, effectiveBranchId);

        if (updatedProducts) {
            // Cache invalidation is handled in ProductsModel
            const emitBranchId = updatedProducts.branch_id || effectiveBranchId;
            if (emitBranchId) {
                this.socketService.emitToBranch(emitBranchId, RealtimeEvents.products.update, updatedProducts);
            }
            return updatedProducts;
        }

        throw new AppError("พบข้อผิดพลาดในการอัปเดตสินค้า", 500);
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.productsModel.findOne(id, branchId);
        if (!existing) {
            throw new AppError("Product not found", 404);
        }

        await this.productsModel.delete(id, branchId);
        // Cache invalidation is handled in ProductsModel
        const effectiveBranchId = existing.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.products.delete, { id });
        }
    }
}
