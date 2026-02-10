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
exports.OrderQueueService = void 0;
const OrderQueue_1 = require("../../entity/pos/OrderQueue");
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const socket_service_1 = require("../socket.service");
const AppError_1 = require("../../utils/AppError");
const cache_1 = require("../../utils/cache");
const dbContext_1 = require("../../database/dbContext");
const realtimeEvents_1 = require("../../utils/realtimeEvents");
class OrderQueueService {
    constructor() {
        this.socketService = socket_service_1.SocketService.getInstance();
        this.CACHE_PREFIX = 'order-queue';
        this.CACHE_TTL = 2 * 1000; // 2 seconds
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
    invalidateQueueCache(branchId) {
        const ctx = (0, dbContext_1.getDbContext)();
        const effectiveBranchId = branchId !== null && branchId !== void 0 ? branchId : ctx === null || ctx === void 0 ? void 0 : ctx.branchId;
        if (!effectiveBranchId) {
            (0, cache_1.invalidateCache)([`${this.CACHE_PREFIX}:`]);
            return;
        }
        (0, cache_1.invalidateCache)([(0, cache_1.cacheKey)(this.CACHE_PREFIX, "branch", effectiveBranchId, "list")]);
    }
    /**
     * Add order to queue
     */
    addToQueue(orderId_1) {
        return __awaiter(this, arguments, void 0, function* (orderId, priority = OrderQueue_1.QueuePriority.Normal, branchId) {
            const queueRepository = (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue);
            const orderRepository = (0, dbContext_1.getRepository)(SalesOrder_1.SalesOrder);
            // Check if order exists
            const order = yield orderRepository.findOne({ where: { id: orderId } });
            if (!order) {
                throw AppError_1.AppError.notFound("Order not found");
            }
            const effectiveBranchId = branchId || order.branch_id;
            // Check if already in queue
            const existing = yield queueRepository.findOne({ where: { order_id: orderId } });
            if (existing) {
                throw AppError_1.AppError.conflict("Order already in queue");
            }
            // Get next queue position
            const queuePosition = yield this.getNextQueuePosition(effectiveBranchId);
            const queueItem = queueRepository.create({
                order_id: orderId,
                branch_id: effectiveBranchId,
                status: OrderQueue_1.QueueStatus.Pending,
                priority,
                queue_position: queuePosition,
            });
            const saved = yield queueRepository.save(queueItem);
            this.invalidateQueueCache(effectiveBranchId);
            // Emit socket event
            this.socketService.emitToBranch(effectiveBranchId || "", realtimeEvents_1.RealtimeEvents.orderQueue.added, saved);
            return saved;
        });
    }
    /**
     * Get next queue position
     */
    getNextQueuePosition(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueRepository = (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue);
            // Reset daily: get max position created today
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const query = queueRepository
                .createQueryBuilder('queue')
                .select('MAX(queue.queue_position)', 'max')
                .where('queue.created_at >= :startOfToday', { startOfToday });
            if (branchId) {
                query.andWhere('queue.branch_id = :branchId', { branchId });
            }
            const result = yield query.getRawOne();
            return ((result === null || result === void 0 ? void 0 : result.max) || 0) + 1;
        });
    }
    /**
     * Get queue list
     */
    getQueue(branchId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const scope = this.getCacheScopeParts(branchId);
            const key = (0, cache_1.cacheKey)(this.CACHE_PREFIX, ...scope, "list", status || "all");
            return (0, cache_1.withCache)(key, () => __awaiter(this, void 0, void 0, function* () {
                const queueRepository = (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue);
                const query = queueRepository
                    .createQueryBuilder('queue')
                    .leftJoinAndSelect('queue.order', 'order')
                    .orderBy('queue.priority', 'DESC')
                    .addOrderBy('queue.queue_position', 'ASC');
                if (branchId) {
                    query.where('queue.branch_id = :branchId', { branchId });
                }
                if (status) {
                    query.andWhere('queue.status = :status', { status });
                }
                return query.getMany();
            }), this.CACHE_TTL, cache_1.queryCache);
        });
    }
    /**
     * Get a single queue item by ID (optionally scoped to a branch)
     */
    getQueueItem(queueId, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue).findOne({
                where: branchId ? { id: queueId, branch_id: branchId } : { id: queueId },
            });
        });
    }
    /**
     * Update queue status
     */
    updateStatus(queueId, status, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueItem = yield this.getQueueItem(queueId, branchId);
            if (!queueItem) {
                throw AppError_1.AppError.notFound("Queue item not found");
            }
            queueItem.status = status;
            if (status === OrderQueue_1.QueueStatus.Processing) {
                queueItem.started_at = new Date();
            }
            else if (status === OrderQueue_1.QueueStatus.Completed || status === OrderQueue_1.QueueStatus.Cancelled) {
                queueItem.completed_at = new Date();
            }
            const saved = yield (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue).save(queueItem);
            this.invalidateQueueCache(saved.branch_id || branchId);
            // Emit socket event
            this.socketService.emitToBranch(saved.branch_id || '', realtimeEvents_1.RealtimeEvents.orderQueue.updated, saved);
            return saved;
        });
    }
    /**
     * Remove from queue
     */
    removeFromQueue(queueId, branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueItem = yield this.getQueueItem(queueId, branchId);
            if (!queueItem) {
                throw AppError_1.AppError.notFound("Queue item not found");
            }
            yield (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue).remove(queueItem);
            this.invalidateQueueCache(queueItem.branch_id || branchId);
            // Emit socket event
            this.socketService.emitToBranch(queueItem.branch_id || '', realtimeEvents_1.RealtimeEvents.orderQueue.removed, { id: queueId });
        });
    }
    /**
     * Reorder queue positions
     */
    reorderQueue(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueRepository = (0, dbContext_1.getRepository)(OrderQueue_1.OrderQueue);
            const queueItems = yield queueRepository.find({
                where: branchId ? { branch_id: branchId, status: OrderQueue_1.QueueStatus.Pending } : { status: OrderQueue_1.QueueStatus.Pending },
                order: { priority: "DESC", queue_position: "ASC" },
            });
            // Sort by priority and current position
            queueItems.sort((a, b) => {
                const priorityOrder = {
                    [OrderQueue_1.QueuePriority.Urgent]: 4,
                    [OrderQueue_1.QueuePriority.High]: 3,
                    [OrderQueue_1.QueuePriority.Normal]: 2,
                    [OrderQueue_1.QueuePriority.Low]: 1,
                };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0)
                    return priorityDiff;
                return a.queue_position - b.queue_position;
            });
            // Update positions
            for (let i = 0; i < queueItems.length; i++) {
                queueItems[i].queue_position = i + 1;
            }
            yield (0, dbContext_1.runInTransaction)((manager) => __awaiter(this, void 0, void 0, function* () {
                yield manager.getRepository(OrderQueue_1.OrderQueue).save(queueItems);
            }));
            this.invalidateQueueCache(branchId);
            // Emit socket event with minimal payload so clients can patch cache without full refetch
            this.socketService.emitToBranch(branchId || '', realtimeEvents_1.RealtimeEvents.orderQueue.reordered, {
                branchId,
                updates: queueItems.map((q) => ({ id: q.id, queue_position: q.queue_position, priority: q.priority }))
            });
        });
    }
}
exports.OrderQueueService = OrderQueueService;
