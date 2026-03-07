import { Job, Worker } from "bullmq";
import { createBullMqWorkerConnection } from "../bullmq.connection";
import {
    AnyPosBackgroundJobData,
    AnyPosBackgroundJobResult,
    GenerateReportJobData,
    GenerateReportJobResult,
    POS_BACKGROUND_QUEUE_NAME,
    PosBackgroundJobNames,
    SyncStockJobData,
    SyncStockJobResult,
} from "../posBackground.queue";
import { processGenerateReport } from "../processors/generateReport.processor";
import { processSyncStock } from "../processors/syncStock.processor";

export function createPosBackgroundWorker(): Worker<
    AnyPosBackgroundJobData,
    AnyPosBackgroundJobResult,
    PosBackgroundJobNames
> {
    const concurrency = Number(process.env.BULLMQ_WORKER_CONCURRENCY || 4);

    const worker = new Worker<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, PosBackgroundJobNames>(
        POS_BACKGROUND_QUEUE_NAME,
        async (job) => {
            switch (job.name) {
                case PosBackgroundJobNames.GenerateReport:
                    return processGenerateReport(
                        job as Job<
                            GenerateReportJobData,
                            GenerateReportJobResult,
                            PosBackgroundJobNames.GenerateReport
                        >
                    );
                case PosBackgroundJobNames.SyncStock:
                    return processSyncStock(
                        job as Job<SyncStockJobData, SyncStockJobResult, PosBackgroundJobNames.SyncStock>
                    );
                default:
                    throw new Error(`Unsupported POS background job: ${job.name}`);
            }
        },
        {
            connection: createBullMqWorkerConnection() as any,
            concurrency: Number.isFinite(concurrency) && concurrency > 0 ? Math.trunc(concurrency) : 4,
        }
    );

    worker.on("completed", (job) => {
        console.info(`[BullMQ] Job completed`, {
            queue: POS_BACKGROUND_QUEUE_NAME,
            jobId: job.id,
            name: job.name,
        });
    });

    worker.on("failed", (job, error) => {
        console.error(`[BullMQ] Job failed`, {
            queue: POS_BACKGROUND_QUEUE_NAME,
            jobId: job?.id,
            name: job?.name,
            attemptsMade: job?.attemptsMade ?? 0,
            attemptsConfigured: job?.opts.attempts ?? 0,
            error: error.message,
        });
    });

    worker.on("error", (error) => {
        console.error("[BullMQ] Worker runtime error", error);
    });

    worker.on("stalled", (jobId) => {
        console.warn(`[BullMQ] Job stalled`, {
            queue: POS_BACKGROUND_QUEUE_NAME,
            jobId,
        });
    });

    return worker;
}
