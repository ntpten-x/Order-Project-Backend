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
const database_1 = require("../../database/database");
const OrderQueue_1 = require("../../entity/pos/OrderQueue");
const SalesOrder_1 = require("../../entity/pos/SalesOrder");
const socket_service_1 = require("../socket.service");
const AppError_1 = require("../../utils/AppError");
class OrderQueueService {
    constructor() {
        this.queueRepository = database_1.AppDataSource.getRepository(OrderQueue_1.OrderQueue);
        this.orderRepository = database_1.AppDataSource.getRepository(SalesOrder_1.SalesOrder);
        this.socketService = socket_service_1.SocketService.getInstance();
    }
    /**
     * Add order to queue
     */
    addToQueue(orderId_1) {
        return __awaiter(this, arguments, void 0, function* (orderId, priority = OrderQueue_1.QueuePriority.Normal, branchId) {
            // Check if order exists
            const order = yield this.orderRepository.findOne({ where: { id: orderId } });
            if (!order) {
                throw AppError_1.AppError.notFound("Order not found");
            }
            // Check if already in queue
            const existing = yield this.queueRepository.findOne({ where: { order_id: orderId } });
            if (existing) {
                throw AppError_1.AppError.conflict("Order already in queue");
            }
            // Get next queue position
            const queuePosition = yield this.getNextQueuePosition(branchId);
            const queueItem = this.queueRepository.create({
                order_id: orderId,
                branch_id: branchId || order.branch_id,
                status: OrderQueue_1.QueueStatus.Pending,
                priority,
                queue_position: queuePosition,
            });
            const saved = yield this.queueRepository.save(queueItem);
            // Emit socket event
            this.socketService.emitToBranch(saved.branch_id || '', 'order-queue:added', saved);
            return saved;
        });
    }
    /**
     * Get next queue position
     */
    getNextQueuePosition(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = this.queueRepository
                .createQueryBuilder('queue')
                .select('MAX(queue.queue_position)', 'max');
            if (branchId) {
                query.where('queue.branch_id = :branchId', { branchId });
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
            const query = this.queueRepository
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
        });
    }
    /**
     * Update queue status
     */
    updateStatus(queueId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueItem = yield this.queueRepository.findOne({ where: { id: queueId } });
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
            const saved = yield this.queueRepository.save(queueItem);
            // Emit socket event
            this.socketService.emitToBranch(saved.branch_id || '', 'order-queue:updated', saved);
            return saved;
        });
    }
    /**
     * Remove from queue
     */
    removeFromQueue(queueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueItem = yield this.queueRepository.findOne({ where: { id: queueId } });
            if (!queueItem) {
                throw AppError_1.AppError.notFound("Queue item not found");
            }
            yield this.queueRepository.remove(queueItem);
            // Emit socket event
            this.socketService.emitToBranch(queueItem.branch_id || '', 'order-queue:removed', { id: queueId });
        });
    }
    /**
     * Reorder queue positions
     */
    reorderQueue(branchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const queueItems = yield this.getQueue(branchId, OrderQueue_1.QueueStatus.Pending);
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
                yield this.queueRepository.save(queueItems[i]);
            }
            // Emit socket event
            this.socketService.emitToBranch(branchId || '', 'order-queue:reordered', { branchId });
        });
    }
}
exports.OrderQueueService = OrderQueueService;
