import { Request, Response } from "express";
import { OrderQueueService } from "../../services/pos/orderQueue.service";
import { QueueStatus, QueuePriority } from "../../entity/pos/OrderQueue";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { auditLogger, AuditActionType } from "../../utils/auditLogger";
import { getClientIp } from "../../utils/securityLogger";
import { getBranchId } from "../../middleware/branch.middleware";

export class OrderQueueController {
    private queueService = new OrderQueueService();

    /**
     * Add order to queue
     */
    addToQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const { orderId, priority } = req.body;
        const branchId = getBranchId(req as any);

        if (!orderId) {
            throw AppError.badRequest("Order ID is required");
        }

        const queuePriority = priority || QueuePriority.Normal;
        const queueItem = await this.queueService.addToQueue(orderId, queuePriority, branchId);

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.QUEUE_ADD,
            user_id: req.user?.id,
            username: req.user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'OrderQueue',
            entity_id: queueItem.id,
            branch_id: branchId,
            new_values: { order_id: orderId, priority: queuePriority, status: queueItem.status },
            description: `Added order ${orderId} to queue`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.created(res, queueItem);
    });

    /**
     * Get queue list
     */
    getQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);
        const status = req.query.status as QueueStatus | undefined;

        const queue = await this.queueService.getQueue(branchId, status);

        return ApiResponses.ok(res, queue);
    });

    /**
     * Update queue status
     */
    updateStatus = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;
        const branchId = getBranchId(req as any);

        if (!status || !Object.values(QueueStatus).includes(status)) {
            throw AppError.badRequest("Invalid status");
        }

        const oldQueueItem = await this.queueService.getQueueItem(id, branchId);
        const updated = await this.queueService.updateStatus(id, status, branchId);

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.QUEUE_UPDATE,
            user_id: req.user?.id,
            username: req.user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'OrderQueue',
            entity_id: id,
            branch_id: branchId,
            old_values: oldQueueItem ? { status: oldQueueItem.status } : undefined,
            new_values: { status },
            description: `Updated queue status to ${status}`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.ok(res, updated);
    });

    /**
     * Remove from queue
     */
    removeFromQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const branchId = getBranchId(req as any);

        const oldQueueItem = await this.queueService.getQueueItem(id, branchId);
        await this.queueService.removeFromQueue(id, branchId);

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.QUEUE_REMOVE,
            user_id: req.user?.id,
            username: req.user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'OrderQueue',
            entity_id: id,
            branch_id: branchId,
            old_values: oldQueueItem ? { order_id: oldQueueItem.order_id, status: oldQueueItem.status, priority: oldQueueItem.priority } : undefined,
            description: oldQueueItem ? `Removed order ${oldQueueItem.order_id} from queue` : `Removed queue item ${id}`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.noContent(res);
    });

    /**
     * Reorder queue
     */
    reorderQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = getBranchId(req as any);

        await this.queueService.reorderQueue(branchId);

        // Audit log
        await auditLogger.log({
            action_type: AuditActionType.QUEUE_REORDER,
            user_id: req.user?.id,
            username: req.user?.username,
            ip_address: getClientIp(req),
            user_agent: req.headers['user-agent'],
            entity_type: 'OrderQueue',
            branch_id: branchId,
            description: `Reordered queue`,
            path: req.path,
            method: req.method,
        });

        return ApiResponses.ok(res, { message: "Queue reordered successfully" });
    });
}
