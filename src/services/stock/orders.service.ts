import { PurchaseOrderStatus } from "../../entity/stock/PurchaseOrder";
import { StockOrdersModel } from "../../models/stock/orders.model";
import { SocketService } from "../socket.service";
import { withCache, cacheKey, invalidateCache, queryCache } from "../../utils/cache";
import { getDbContext } from "../../database/dbContext";
import { LegacyRealtimeEvents, RealtimeEvents } from "../../utils/realtimeEvents";
import { CreatedSort } from "../../utils/sortCreated";

/**
 * Orders Service with Caching
 * Following supabase-postgres-best-practices: server-cache-lru
 */
export class OrdersService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = 'stock:orders';
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

    constructor(private ordersModel: StockOrdersModel) { }

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    async createOrder(orderedById: string, items: { ingredient_id: string; quantity_ordered: number }[], remark?: string, branchId?: string) {
        const completeOrder = await this.ordersModel.createOrderWithItems(orderedById, items, remark, branchId);
        const emitBranchId = branchId || (completeOrder as any).branch_id;
        // Invalidate list cache
        this.invalidateCache(emitBranchId);
        if (emitBranchId) {
            this.emitStockOrders(
                emitBranchId,
                RealtimeEvents.stockOrders.create,
                completeOrder,
                { action: "create", data: completeOrder }
            );
        }
        return completeOrder;
    }

    async getAllOrders(
        filters?: { status?: PurchaseOrderStatus | PurchaseOrderStatus[] },
        page: number = 1,
        limit: number = 50,
        branchId?: string,
        sortCreated: CreatedSort = "old"
    ) {
        const filterKey = filters?.status 
            ? (Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
            : 'all';
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'list', page, limit, filterKey, sortCreated);
        
        // Skip cache if page > 1 (too many variants)
        if (page > 1) {
            return await this.ordersModel.findAll(filters, page, limit, branchId, sortCreated);
        }
        
        return withCache(
            key,
            () => this.ordersModel.findAll(filters, page, limit, branchId, sortCreated),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async getOrderById(id: string, branchId?: string) {
        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, 'single', id);
        
        return withCache(
            key,
            () => this.ordersModel.findById(id, branchId),
            this.CACHE_TTL,
            queryCache as any
        );
    }

    async updateOrder(id: string, items: { ingredient_id: string; quantity_ordered: number }[], branchId?: string) {
        const updatedOrder = await this.ordersModel.updateOrderItems(id, items, branchId);
        const effectiveBranchId = branchId || (updatedOrder as any)?.branch_id;
        this.invalidateCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.emitStockOrders(
                effectiveBranchId,
                RealtimeEvents.stockOrders.update,
                updatedOrder,
                { action: "update_order", data: updatedOrder }
            );
        }
        return updatedOrder;
    }

    async updateStatus(id: string, status: PurchaseOrderStatus, branchId?: string) {
        const updatedOrder = await this.ordersModel.updateStatus(id, status, branchId);
        if (!updatedOrder) throw new Error("ไม่พบข้อมูลการสั่งซื้อ");

        const effectiveBranchId = branchId || (updatedOrder as any)?.branch_id;
        this.invalidateCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.emitStockOrders(
                effectiveBranchId,
                RealtimeEvents.stockOrders.status,
                updatedOrder,
                { action: "update_status", data: updatedOrder }
            );
        }
        return updatedOrder;
    }

    async deleteOrder(id: string, branchId?: string) {
        const deleted = await this.ordersModel.delete(id, branchId);
        if (deleted) {
            this.invalidateCache(branchId, id);
            if (branchId) {
                this.emitStockOrders(
                    branchId,
                    RealtimeEvents.stockOrders.delete,
                    { id },
                    { action: "delete", id }
                );
            }
        }
        return { affected: deleted ? 1 : 0 };
    }

    async confirmPurchase(id: string, items: { ingredient_id: string; actual_quantity: number; is_purchased: boolean }[], purchasedById: string, branchId?: string) {
        const updatedOrder = await this.ordersModel.confirmPurchase(id, items, purchasedById, branchId);
        const effectiveBranchId = branchId || (updatedOrder as any)?.branch_id;
        this.invalidateCache(effectiveBranchId, id);
        if (effectiveBranchId) {
            this.emitStockOrders(
                effectiveBranchId,
                RealtimeEvents.stockOrders.status,
                updatedOrder,
                { action: "update_status", data: updatedOrder }
            );
        }
        return updatedOrder;
    }

    /**
     * Invalidate orders cache
     */
    private invalidateCache(branchId?: string, id?: string): void {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (!effectiveBranchId) {
            invalidateCache([`${this.CACHE_PREFIX}:`]);
            return;
        }

        const patterns = [cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "list")];
        if (id) {
            patterns.push(cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
        }
        invalidateCache(patterns);
    }

    private emitStockOrders(
        branchId: string,
        event: string,
        payload: unknown,
        legacyPayload?: unknown
    ): void {
        this.socketService.emitToBranch(branchId, event, payload);
        this.socketService.emitToBranch(branchId, RealtimeEvents.stock.update, {
            source: "stock-orders",
            event,
        });
        if (legacyPayload) {
            this.socketService.emitToBranch(branchId, LegacyRealtimeEvents.stockOrdersUpdated, legacyPayload);
        }
    }
}
