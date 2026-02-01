import { PurchaseOrder, PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersModel } from "../../models/stock/orders.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, invalidateCache, queryCache } from "../../utils/cache";

/**
 * Orders Service with Caching
 * Following supabase-postgres-best-practices: server-cache-lru
 */
export class OrdersService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = 'stock:orders';
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

    constructor(private ordersModel: StockOrdersModel) { }

    async createOrder(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string, branchId?: string) {
        const completeOrder = await this.ordersModel.createOrderWithItems(orderedById, items, remark, branchId);
        // Invalidate list cache
        this.invalidateCache();
        this.socketService.emit("orders_updated", { action: "create", data: completeOrder });
        return completeOrder;
    }

    async getAllOrders(filters?: { status?: PurchaseOrderStatus | PurchaseOrderStatus[] }, page: number = 1, limit: number = 50, branchId?: string) {
        const filterKey = filters?.status 
            ? (Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
            : 'all';
        const key = cacheKey(this.CACHE_PREFIX, 'list', page, limit, filterKey, branchId || 'all');
        
        // Skip cache if page > 1 (too many variants)
        if (page > 1) {
            return await this.ordersModel.findAll(filters, page, limit, branchId);
        }
        
        return withCache(
            key,
            () => this.ordersModel.findAll(filters, page, limit, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async getOrderById(id: string) {
        const key = cacheKey(this.CACHE_PREFIX, 'single', id);
        
        return withCache(
            key,
            () => this.ordersModel.findById(id),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async updateOrder(id: string, items: { ingredient_id: string; quantity_ordered: number }[]) {
        const updatedOrder = await this.ordersModel.updateOrderItems(id, items);
        this.invalidateCache(id);
        this.socketService.emit("orders_updated", { action: "update_order", data: updatedOrder });
        return updatedOrder;
    }

    async updateStatus(id: string, status: PurchaseOrderStatus) {
        const updatedOrder = await this.ordersModel.updateStatus(id, status);
        if (!updatedOrder) throw new Error("ไม่พบข้อมูลการสั่งซื้อ");

        this.invalidateCache(id);
        this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
        return updatedOrder;
    }

    async deleteOrder(id: string) {
        const deleted = await this.ordersModel.delete(id);
        if (deleted) {
            this.invalidateCache(id);
            this.socketService.emit("orders_updated", { action: "delete", id });
        }
        return { affected: deleted ? 1 : 0 };
    }

    async confirmPurchase(id: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string) {
        const updatedOrder = await this.ordersModel.confirmPurchase(id, items, purchasedById);
        this.invalidateCache(id);
        this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
        return updatedOrder;
    }

    /**
     * Invalidate orders cache
     */
    private invalidateCache(id?: string): void {
        const patterns = [`${this.CACHE_PREFIX}:list`];
        if (id) {
            patterns.push(`${this.CACHE_PREFIX}:single:${id}`);
        }
        invalidateCache(patterns);
    }
}
