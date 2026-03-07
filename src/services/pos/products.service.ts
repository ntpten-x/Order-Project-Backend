import { ProductsModels } from "../../models/pos/products.model";
import { SocketService } from "../socket.service";
import { Products } from "../../entity/pos/Products";
import { AppError } from "../../utils/AppError";
import { RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";
import { getRepository } from "../../database/dbContext";
import { SalesOrderItem } from "../../entity/pos/SalesOrderItem";

export class ProductsService {
    private socketService = SocketService.getInstance();

    constructor(private productsModel: ProductsModels) { }

    private normalizeMutableFields(product: Partial<Products>, fallback?: Products): Partial<Products> {
        const next = { ...product };

        if (next.display_name !== undefined) {
            const value = next.display_name.trim();
            if (!value) {
                throw AppError.badRequest("Product name is required");
            }
            next.display_name = value;
        }

        if (next.description !== undefined) {
            next.description = next.description.trim();
        }

        if (next.price_delivery === undefined || next.price_delivery === null) {
            if (next.price !== undefined && next.price !== null) {
                next.price_delivery = next.price;
            } else if (fallback?.price_delivery !== undefined && fallback?.price_delivery !== null) {
                next.price_delivery = fallback.price_delivery;
            }
        }

        return next;
    }

    async findAll(
        page: number,
        limit: number,
        category_id?: string,
        q?: string,
        is_active?: boolean,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ): Promise<{ data: Products[]; total: number; page: number; last_page: number }> {
        return this.productsModel.findAll(page, limit, category_id, q, is_active, branchId, sortCreated);
    }

    async countActive(category_id?: string, branchId?: string): Promise<number> {
        return this.productsModel.countActive(category_id, branchId);
    }

    async findOne(id: string, branchId?: string): Promise<Products | null> {
        return this.productsModel.findOne(id, branchId);
    }

    async findOneByName(name: string, branchId?: string): Promise<Products | null> {
        return this.productsModel.findOneByName(name, branchId);
    }

    async create(products: Products): Promise<Products> {
        const normalizedProducts = this.normalizeMutableFields(products) as Products;
        const branchId = normalizedProducts.branch_id;

        if (!normalizedProducts.category_id) {
            throw AppError.badRequest("Product category is required");
        }
        if (!normalizedProducts.unit_id) {
            throw AppError.badRequest("Product unit is required");
        }
        if (!normalizedProducts.display_name) {
            throw AppError.badRequest("Product name is required");
        }

        const existingProduct = await this.productsModel.findOneByName(normalizedProducts.display_name, branchId);
        if (existingProduct) {
            throw AppError.conflict("Product name already exists");
        }

        const savedProducts = await this.productsModel.create(normalizedProducts);
        const createdProducts = await this.productsModel.findOne(savedProducts.id, branchId);

        if (!createdProducts) {
            throw new AppError("Failed to create product", 500);
        }

        if (createdProducts.branch_id) {
            this.socketService.emitToBranch(createdProducts.branch_id, RealtimeEvents.products.create, createdProducts);
        }
        return createdProducts;
    }

    async update(id: string, products: Products, branchId?: string): Promise<Products> {
        const existingProduct = await this.productsModel.findOne(id, branchId || products.branch_id);
        if (!existingProduct) {
            throw AppError.notFound("Product");
        }

        const normalizedProducts = this.normalizeMutableFields(products, existingProduct) as Products;
        const effectiveBranchId = branchId || existingProduct.branch_id || normalizedProducts.branch_id;
        if (effectiveBranchId) {
            normalizedProducts.branch_id = effectiveBranchId;
        }

        const normalizedIncomingName = normalizedProducts.display_name?.trim().toLowerCase();
        const normalizedCurrentName = existingProduct.display_name?.trim().toLowerCase();

        if (normalizedIncomingName && normalizedIncomingName !== normalizedCurrentName) {
            const duplicate = await this.productsModel.findOneByName(normalizedProducts.display_name!, effectiveBranchId);
            if (duplicate && duplicate.id !== id) {
                throw AppError.conflict("Product name already exists");
            }
        }

        await this.productsModel.update(id, normalizedProducts, effectiveBranchId);
        const updatedProducts = await this.productsModel.findOne(id, effectiveBranchId);

        if (!updatedProducts) {
            throw new AppError("Failed to update product", 500);
        }

        const emitBranchId = updatedProducts.branch_id || effectiveBranchId;
        if (emitBranchId) {
            this.socketService.emitToBranch(emitBranchId, RealtimeEvents.products.update, updatedProducts);
        }
        return updatedProducts;
    }

    async delete(id: string, branchId?: string): Promise<void> {
        const existing = await this.productsModel.findOne(id, branchId);
        if (!existing) {
            throw AppError.notFound("Product");
        }

        const orderItemCount = await getRepository(SalesOrderItem).count({
            where: { product_id: id } as any,
        });
        if (orderItemCount > 0) {
            throw AppError.conflict("Product cannot be deleted because it is referenced by order items");
        }

        await this.productsModel.delete(id, branchId);
        const effectiveBranchId = existing.branch_id || branchId;
        if (effectiveBranchId) {
            this.socketService.emitToBranch(effectiveBranchId, RealtimeEvents.products.delete, { id });
        }
    }
}
