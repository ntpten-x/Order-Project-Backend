import { AppDataSource } from "../../database/database";
import { OrderQueue, QueueStatus, QueuePriority } from "../../entity/pos/OrderQueue";
import { SalesOrder } from "../../entity/pos/SalesOrder";
import { SocketService } from "../socket.service";
import { AppError } from "../../utils/AppError";

export class OrderQueueService {
    private queueRepository = AppDataSource.getRepository(OrderQueue);
    private orderRepository = AppDataSource.getRepository(SalesOrder);
    private socketService = SocketService.getInstance();

    /**
     * Add order to queue
     */
    async addToQueue(orderId: string, priority: QueuePriority = QueuePriority.Normal, branchId?: string): Promise<OrderQueue> {
        // Check if order exists
        const order = await this.orderRepository.findOne({ where: { id: orderId } });
        if (!order) {
            throw AppError.notFound("Order not found");
        }

        // Check if already in queue
        const existing = await this.queueRepository.findOne({ where: { order_id: orderId } });
        if (existing) {
            throw AppError.conflict("Order already in queue");
        }

        // Get next queue position
        const queuePosition = await this.getNextQueuePosition(branchId);

        const queueItem = this.queueRepository.create({
            order_id: orderId,
            branch_id: branchId || order.branch_id,
            status: QueueStatus.Pending,
            priority,
            queue_position: queuePosition,
        });

        const saved = await this.queueRepository.save(queueItem);
        
        // Emit socket event
        this.socketService.emitToBranch(
            saved.branch_id || '',
            'order-queue:added',
            saved
        );

        return saved;
    }

    /**
     * Get next queue position
     */
    private async getNextQueuePosition(branchId?: string): Promise<number> {
        const query = this.queueRepository
            .createQueryBuilder('queue')
            .select('MAX(queue.queue_position)', 'max');

        if (branchId) {
            query.where('queue.branch_id = :branchId', { branchId });
        }

        const result = await query.getRawOne();
        return (result?.max || 0) + 1;
    }

    /**
     * Get queue list
     */
    async getQueue(branchId?: string, status?: QueueStatus): Promise<OrderQueue[]> {
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
    }

    /**
     * Update queue status
     */
    async updateStatus(queueId: string, status: QueueStatus): Promise<OrderQueue> {
        const queueItem = await this.queueRepository.findOne({ where: { id: queueId } });
        if (!queueItem) {
            throw AppError.notFound("Queue item not found");
        }

        queueItem.status = status;

        if (status === QueueStatus.Processing) {
            queueItem.started_at = new Date();
        } else if (status === QueueStatus.Completed || status === QueueStatus.Cancelled) {
            queueItem.completed_at = new Date();
        }

        const saved = await this.queueRepository.save(queueItem);

        // Emit socket event
        this.socketService.emitToBranch(
            saved.branch_id || '',
            'order-queue:updated',
            saved
        );

        return saved;
    }

    /**
     * Remove from queue
     */
    async removeFromQueue(queueId: string): Promise<void> {
        const queueItem = await this.queueRepository.findOne({ where: { id: queueId } });
        if (!queueItem) {
            throw AppError.notFound("Queue item not found");
        }

        await this.queueRepository.remove(queueItem);

        // Emit socket event
        this.socketService.emitToBranch(
            queueItem.branch_id || '',
            'order-queue:removed',
            { id: queueId }
        );
    }

    /**
     * Reorder queue positions
     */
    async reorderQueue(branchId?: string): Promise<void> {
        const queueItems = await this.getQueue(branchId, QueueStatus.Pending);
        
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
            await this.queueRepository.save(queueItems[i]);
        }

        // Emit socket event
        this.socketService.emitToBranch(
            branchId || '',
            'order-queue:reordered',
            { branchId }
        );
    }
}
