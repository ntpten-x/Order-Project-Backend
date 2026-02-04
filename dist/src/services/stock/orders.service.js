"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const socket_service_1 = require("../socket.service");
const cache_1 = require("../../utils/cache");
const dbContext_1 = require("../../database/dbContext");
/**
 * Orders Service with Caching
 * Following supabase-postgres-best-practices: server-cache-lru
 */
class OrdersService {
    constructor(ordersModel) {
        this.ordersModel = ordersModel;
        this.socketService = socket_service_1.SocketService.getInstance();
        this.CACHE_PREFIX = 'stock:orders';
        this.CACHE_TTL = 2 * 60 * 1000; // 2 minutes
    }
    getCacheScopeParts(branchId) {
        const ctx = (0, dbContext_1.getDbContext)();
        const effectiveBranchId = branchId !== null && branchId !== void 0 ? branchId : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
        if (effectiveBranchId)
            return ["branch", effectiveBranchId];
        if (ctx === null || ctx === void 0 ? void 0 : ctx.isAdmin)
            return ["admin"];
        return ["public"];
    }
    createOrder(orderedById, items, remark, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const completeOrder = yield this.ordersModel.createOrderWithItems(orderedById, items, remark, branchId);
            const emitBranchId = branchId || completeOrder.branch_id;
            // Invalidate list cache
            this.invalidateCache(emitBranchId);
            if (emitBranchId) {
                this.socketService.emitToBranch(emitBranchId, "orders_updated", { action: "create", data: completeOrder });
            }
            return completeOrder;
        });
    }
    getAllOrders(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, page = 1, limit = 50, branchId) {
            const filterKey = (filters === null || filters === void 0 ? void 0 : filters.status)
                ? (Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
                : 'all';
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'list', page, limit, filterKey);
            // Skip cache if page > 1 (too many variants)
            if (page > 1) {
                return yield this.ordersModel.findAll(filters, page, limit, branchId);
            }
            return (0, cache_1.withCache)(key, () => this.ordersModel.findAll(filters, page, limit, branchId), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    getOrderById(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, 'single', id);
            return (0, cache_1.withCache)(key, () => this.ordersModel.findById(id, branchId), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    updateOrder(id, items, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedOrder = yield this.ordersModel.updateOrderItems(id, items, branchId);
            const effectiveBranchId = branchId || (updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder.branch_id);
            this.invalidateCache(effectiveBranchId, id);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, "orders_updated", { action: "update_order", data: updatedOrder });
            }
            return updatedOrder;
        });
    }
    updateStatus(id, status, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedOrder = yield this.ordersModel.updateStatus(id, status, branchId);
            if (!updatedOrder)
                throw new Error("ไม่พบข้อมูลการสั่งซื้อ");
            const effectiveBranchId = branchId || (updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder.branch_id);
            this.invalidateCache(effectiveBranchId, id);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, "orders_updated", { action: "update_status", data: updatedOrder });
            }
            return updatedOrder;
        });
    }
    deleteOrder(id, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleted = yield this.ordersModel.delete(id, branchId);
            if (deleted) {
                this.invalidateCache(branchId, id);
                if (branchId) {
                    this.socketService.emitToBranch(branchId, "orders_updated", { action: "delete", id });
                }
            }
            return { affected: deleted ? 1 : 0 };
        });
    }
    confirmPurchase(id, items, purchasedById, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedOrder = yield this.ordersModel.confirmPurchase(id, items, purchasedById, branchId);
            const effectiveBranchId = branchId || (updatedOrder === null || updatedOrder === void 0 ? void 0 : updatedOrder.branch_id);
            this.invalidateCache(effectiveBranchId, id);
            if (effectiveBranchId) {
                this.socketService.emitToBranch(effectiveBranchId, "orders_updated", { action: "update_status", data: updatedOrder });
            }
            return updatedOrder;
        });
    }
    /**
     * Invalidate orders cache
     */
    invalidateCache(branchId, id) {
        const ctx = (0, dbContext_1.getDbContext)();
        const effectiveBranchId = branchId !== null && branchId !== void 0 ? branchId : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
        if (!effectiveBranchId) {
            (0, cache_1.invalidateCache)([`${this.CACHE_PREFIX}:`]);
            return;
        }
        const patterns = [(0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", effectiveBranchId, "list")];
        if (id) {
            patterns.push((0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", effectiveBranchId, "single", id));
        }
        (0, cache_1.invalidateCache)(patterns);
    }
}
exports.OrdersService = OrdersService;
