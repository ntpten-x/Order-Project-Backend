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
    createOrder(orderedById, items, remark, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const completeOrder = yield this.ordersModel.createOrderWithItems(orderedById, items, remark, branchId);
            // Invalidate list cache
            this.invalidateCache();
            this.socketService.emit("orders_updated", { action: "create", data: completeOrder });
            return completeOrder;
        });
    }
    getAllOrders(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, page = 1, limit = 50, branchId) {
            const filterKey = (filters === null || filters === void 0 ? void 0 : filters.status)
                ? (Array.isArray(filters.status) ? filters.status.join(',') : filters.status)
                : 'all';
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, 'list', page, limit, filterKey, branchId || 'all');
            // Skip cache if page > 1 (too many variants)
            if (page > 1) {
                return yield this.ordersModel.findAll(filters, page, limit, branchId);
            }
            return (0, cache_1.withCache)(key, () => this.ordersModel.findAll(filters, page, limit, branchId), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    getOrderById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, 'single', id);
            return (0, cache_1.withCache)(key, () => this.ordersModel.findById(id), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    updateOrder(id, items) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedOrder = yield this.ordersModel.updateOrderItems(id, items);
            this.invalidateCache(id);
            this.socketService.emit("orders_updated", { action: "update_order", data: updatedOrder });
            return updatedOrder;
        });
    }
    updateStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedOrder = yield this.ordersModel.updateStatus(id, status);
            if (!updatedOrder)
                throw new Error("ไม่พบข้อมูลการสั่งซื้อ");
            this.invalidateCache(id);
            this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
            return updatedOrder;
        });
    }
    deleteOrder(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleted = yield this.ordersModel.delete(id);
            if (deleted) {
                this.invalidateCache(id);
                this.socketService.emit("orders_updated", { action: "delete", id });
            }
            return { affected: deleted ? 1 : 0 };
        });
    }
    confirmPurchase(id, items, purchasedById) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedOrder = yield this.ordersModel.confirmPurchase(id, items, purchasedById);
            this.invalidateCache(id);
            this.socketService.emit("orders_updated", { action: "update_status", data: updatedOrder });
            return updatedOrder;
        });
    }
    /**
     * Invalidate orders cache
     */
    invalidateCache(id) {
        const patterns = [`${this.CACHE_PREFIX}:list`];
        if (id) {
            patterns.push(`${this.CACHE_PREFIX}:single:${id}`);
        }
        (0, cache_1.invalidateCache)(patterns);
    }
}
exports.OrdersService = OrdersService;
