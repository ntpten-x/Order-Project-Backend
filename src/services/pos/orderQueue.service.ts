import { OrderQueue, QueueStatus, QueuePriority } from "../../entity/pos/OrderQueue";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SocketService } from "../socket.service";
import { AppError } from "../../utils/AppError";
import { withCache, cacheKey, invalidateCache, queryCache } from "../../utils/cache";
import { getDbContext, getRepository, runInTransaction } from "../../database/dbContext";
import { RealtimeEvents } from "../../utils/realtimeEvents";

export class OrderQueueService {
    private socketService = SocketService.getInstance();
    private readonly CACHE_PREFIX = 'order-queue';
    // Queue state is invalidated on every write/socket event, so a longer TTL cuts repeated DB reads safely.
    private readonly CACHE_TTL = Number(process.env.ORDER_QUEUE_CACHE_TTL_MS || 10_000);

    private getCacheScopeParts(branchId?: string): Array<string> {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (effectiveBranchId) return ["branch", effectiveBranchId];
        if (ctx?.isAdmin) return ["admin"];
        return ["public"];
    }

    private invalidateQueueCache(branchId?: string): void {
        const ctx = getDbContext();
        const effectiveBranchId = branchId ?? ctx?.branchId;
        if (!effectiveBranchId) {
            invalidateCache([`${this.CACHE_PREFIX}:`]);
            return;
        }
        invalidateCache([cacheKey(this.CACHE_PREFIX, "branch", effectiveBranchId, "list")]);
    }

    /**
     * Add order to queue
     */
    async addToQueue(orderId: string, priority: QueuePriority = QueuePriority.Normal, branchId?: string): Promise<OrderQueue> {
        const queueRepository = getRepository(OrderQueue);
        const orderRepository = getRepository(SalesOrder);
        // Branch-scoped lookup prevents cross-branch queue injection.
        const order = await orderRepository.findOne({
            where: branchId ? ({ id: orderId, branch_id: branchId } as any) : { id: orderId }
        });
        if (!order) {
            throw AppError.notFound("Order not found");
        }

        const effectiveBranchId = order.branch_id || branchId;
        if (!effectiveBranchId) {
            throw AppError.badRequest("Branch ID is required for queue operations");
        }

        // Check if already in queue
        const existing = await queueRepository.findOne({ where: { order_id: orderId } });
        if (existing) {
            throw AppError.conflict("Order already in queue");
        }

        // Get next queue position
        const queuePosition = await this.getNextQueuePosition(effectiveBranchId);

        const queueItem = queueRepository.create({
            order_id: orderId,
            branch_id: effectiveBranchId,
            status: QueueStatus.Pending,
            priority,
            queue_position: queuePosition,
        });

        const saved = await queueRepository.save(queueItem);
        this.invalidateQueueCache(effectiveBranchId);

        // Emit socket event
        this.socketService.emitToBranch(
            effectiveBranchId || "",
            RealtimeEvents.orderQueue.added,
            saved
        );

        return saved;
    }

    /**
     * Get next queue position
     */
    private async getNextQueuePosition(branchId?: string): Promise<number> {
        const queueRepository = getRepository(OrderQueue);

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

        const result = await query.getRawOne();
        return (result?.max || 0) + 1;
    }

    /**
     * Get queue list
     */
    async getQueue(branchId?: string, status?: QueueStatus, options?: { bypassCache?: boolean }): Promise<OrderQueue[]> {
        if (options?.bypassCache) {
            const queueRepository = getRepository(OrderQueue);
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
        }

        const scope = this.getCacheScopeParts(branchId);
        const key = cacheKey(this.CACHE_PREFIX, ...scope, "list", status || "all");

        return withCache(
            key,
            async () => {
                const queueRepository = getRepository(OrderQueue);
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
            },
            this.CACHE_TTL,
            queryCache as any
        );
    }

    /**
     * Get a single queue item by ID (optionally scoped to a branch)
     */
    async getQueueItem(queueId: string, branchId?: string): Promise<OrderQueue | null> {
        return getRepository(OrderQueue).findOne({
            where: branchId ? { id: queueId, branch_id: branchId } : { id: queueId },
        });
    }

    /**
     * Update queue status
     */
    async updateStatus(queueId: string, status: QueueStatus, branchId?: string): Promise<OrderQueue> {
        const queueItem = await this.getQueueItem(queueId, branchId);
        if (!queueItem) {
            throw AppError.notFound("Queue item not found");
        }

        queueItem.status = status;

        if (status === QueueStatus.Processing) {
            queueItem.started_at = new Date();
        } else if (status === QueueStatus.Completed || status === QueueStatus.Cancelled) {
            queueItem.completed_at = new Date();
        }

        const saved = await getRepository(OrderQueue).save(queueItem);
        this.invalidateQueueCache(saved.branch_id || branchId);

        // Emit socket event
        this.socketService.emitToBranch(
            saved.branch_id || '',
            RealtimeEvents.orderQueue.updated,
            saved
        );

        return saved;
    }

    /**
     * Remove from queue
     */
    async removeFromQueue(queueId: string, branchId?: string): Promise<void> {
        const queueItem = await this.getQueueItem(queueId, branchId);
        if (!queueItem) {
            throw AppError.notFound("Queue item not found");
        }

        await getRepository(OrderQueue).remove(queueItem);
        this.invalidateQueueCache(queueItem.branch_id || branchId);

        // Emit socket event
        this.socketService.emitToBranch(
            queueItem.branch_id || '',
            RealtimeEvents.orderQueue.removed,
            { id: queueId }
        );
    }

    /**
     * Reorder queue positions
     */
    async reorderQueue(branchId?: string): Promise<void> {
        const queueRepository = getRepository(OrderQueue);
        const queueItems = await queueRepository.find({
            where: branchId ? { branch_id: branchId, status: QueueStatus.Pending } : { status: QueueStatus.Pending },
            order: { priority: "DESC", queue_position: "ASC" },
        });

        // Sort by priority and current position
        queueItems.sort((a, b) => {
            const priorityOrder = {
                [QueuePriority.Urgent]: 4,
                [QueuePriority.High]: 3,
                [QueuePriority.Normal]: 2,
                [QueuePriority.Low]: 1,
            };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.queue_position - b.queue_position;
        });

        // Update positions
        for (let i = 0; i < queueItems.length; i++) {
            queueItems[i].queue_position = i + 1;
        }

        await runInTransaction(async (manager) => {
            await manager.getRepository(OrderQueue).save(queueItems);
        });
        this.invalidateQueueCache(branchId);

        // Emit socket event with minimal payload so clients can patch cache without full refetch
        this.socketService.emitToBranch(
            branchId || '',
            RealtimeEvents.orderQueue.reordered,
            {
                branchId,
                updates: queueItems.map((q) => ({ id: q.id, queue_position: q.queue_position, priority: q.priority }))
            }
        );
    }
}
