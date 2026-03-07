import { Job } from "bullmq";
import { PosBackgroundJobNames, SyncStockJobData, SyncStockJobResult } from "../posBackground.queue";

export async function processSyncStock(
    job: Job<SyncStockJobData, SyncStockJobResult, PosBackgroundJobNames.SyncStock>
): Promise<SyncStockJobResult> {
    if (!job.data.branchId) {
        throw new Error("branchId is required");
    }

    // Replace this stub with the real stock reconciliation flow.
    console.info("[BullMQ] Syncing stock", {
        jobId: job.id,
        branchId: job.data.branchId,
        productId: job.data.productId ?? null,
        reason: job.data.reason,
    });

    return {
        branchId: job.data.branchId,
        productId: job.data.productId,
        processedAt: new Date().toISOString(),
        status: "completed",
    };
}
