import { Job } from "bullmq";
import {
    AnyPosBackgroundJobData,
    AnyPosBackgroundJobResult,
    GenerateReportJobData,
    GenerateReportJobResult,
    getPosBackgroundQueue,
    PosBackgroundJobNames,
    SyncStockJobData,
    SyncStockJobResult,
} from "../../queues/posBackground.queue";

export type PosBackgroundJobStatus = {
    id: string;
    name: string;
    queueName: string;
    state: string;
    progress: string | number | boolean | object | null;
    attemptsMade: number;
    attemptsConfigured: number | null;
    timestamp: number;
    processedOn: number | null;
    finishedOn: number | null;
    failedReason: string | null;
    data: AnyPosBackgroundJobData;
    result: AnyPosBackgroundJobResult | null;
};

export type PosBackgroundJobAccessContext = {
    userId?: string;
    branchId?: string;
    scope?: "none" | "own" | "branch" | "all";
    isAdmin?: boolean;
};

export class BackgroundJobsService {
    private readonly queue = getPosBackgroundQueue();

    async enqueueGenerateReport(
        payload: GenerateReportJobData
    ): Promise<Job<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, string>> {
        const normalizedPayload: GenerateReportJobData = {
            ...payload,
            format: payload.format ?? "json",
            requestedAt: payload.requestedAt ?? new Date().toISOString(),
        };

        return this.queue.add(PosBackgroundJobNames.GenerateReport, normalizedPayload, {
            priority: 2,
        });
    }

    async enqueueSyncStock(
        payload: SyncStockJobData
    ): Promise<Job<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, string>> {
        const normalizedPayload: SyncStockJobData = {
            ...payload,
            requestedAt: payload.requestedAt ?? new Date().toISOString(),
        };

        return this.queue.add(PosBackgroundJobNames.SyncStock, normalizedPayload, {
            priority: 1,
        });
    }

    async getJob(jobId: string): Promise<Job<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, string> | undefined> {
        const job = await this.queue.getJob(jobId);
        return job ?? undefined;
    }

    async getJobStatus(jobId: string): Promise<PosBackgroundJobStatus | undefined> {
        const job = await this.getJob(jobId);
        if (!job) {
            return undefined;
        }

        const state = await job.getState();

        return {
            id: String(job.id),
            name: job.name,
            queueName: job.queueName,
            state,
            progress: job.progress ?? null,
            attemptsMade: job.attemptsMade,
            attemptsConfigured: job.opts.attempts ?? null,
            timestamp: job.timestamp,
            processedOn: job.processedOn ?? null,
            finishedOn: job.finishedOn ?? null,
            failedReason: job.failedReason || null,
            data: job.data,
            result: job.returnvalue ?? null,
        };
    }
}

export const backgroundJobsService = new BackgroundJobsService();
