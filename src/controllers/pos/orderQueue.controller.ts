import { Request, Response } from "express";
import { OrderQueueService } from "../../services/pos/orderQueue.service";
import { QueueStatus, QueuePriority } from "../../entity/pos/OrderQueue";
import { catchAsync } from "../../utils/catchAsync";
import { AppError } from "../../utils/AppError";
import { ApiResponses } from "../../utils/ApiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";

export class OrderQueueController {
    private queueService = new OrderQueueService();

    /**
     * Add order to queue
     */
    addToQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const { orderId, priority } = req.body;
        const branchId = req.user?.branch_id;

        if (!orderId) {
            throw AppError.badRequest("Order ID is required");
        }

        const queuePriority = priority || QueuePriority.Normal;
        const queueItem = await this.queueService.addToQueue(orderId, queuePriority, branchId);

        return ApiResponses.created(res, queueItem);
    });

    /**
     * Get queue list
     */
    getQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = req.user?.branch_id;
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

        if (!status || !Object.values(QueueStatus).includes(status)) {
            throw AppError.badRequest("Invalid status");
        }

        const updated = await this.queueService.updateStatus(id, status);

        return ApiResponses.ok(res, updated);
    });

    /**
     * Remove from queue
     */
    removeFromQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        await this.queueService.removeFromQueue(id);

        return ApiResponses.noContent(res);
    });

    /**
     * Reorder queue
     */
    reorderQueue = catchAsync(async (req: AuthRequest, res: Response) => {
        const branchId = req.user?.branch_id;

        await this.queueService.reorderQueue(branchId);

        return ApiResponses.ok(res, { message: "Queue reordered successfully" });
    });
}
