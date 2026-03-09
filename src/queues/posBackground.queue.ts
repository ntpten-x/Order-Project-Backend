import { JobsOptions, Queue } from "bullmq";
import { getSharedBullMqConnection } from "./bullmq.connection";

export const POS_BACKGROUND_QUEUE_NAME = "pos-background";

export enum PosBackgroundJobNames {
    GenerateReport = "generate-report",
    SyncStock = "sync-stock",
}

export type GenerateReportJobData = {
    reportType: "sales-summary" | "inventory-audit" | "custom";
    requestedByUserId: string;
    branchId?: string;
    format?: "json" | "csv" | "pdf";
    filters?: Record<string, string | number | boolean | null>;
    requestedAt?: string;
};

export type SyncStockJobData = {
    branchId: string;
    triggeredByUserId?: string;
    productId?: string;
    reason: "manual" | "order-paid" | "inventory-adjustment" | "scheduled";
    requestedAt?: string;
};

export type GenerateReportJobResult = {
    reportId: string;
    reportType: GenerateReportJobData["reportType"];
    format: NonNullable<GenerateReportJobData["format"]>;
    generatedAt: string;
    status: "completed";
};

export type SyncStockJobResult = {
    branchId: string;
    productId?: string;
    processedAt: string;
    status: "completed";
};

export type PosBackgroundJobDataMap = {
    [PosBackgroundJobNames.GenerateReport]: GenerateReportJobData;
    [PosBackgroundJobNames.SyncStock]: SyncStockJobData;
};

export type PosBackgroundJobResultMap = {
    [PosBackgroundJobNames.GenerateReport]: GenerateReportJobResult;
    [PosBackgroundJobNames.SyncStock]: SyncStockJobResult;
};

export type AnyPosBackgroundJobData = PosBackgroundJobDataMap[PosBackgroundJobNames];
export type AnyPosBackgroundJobResult = PosBackgroundJobResultMap[PosBackgroundJobNames];

const defaultJobOptions: JobsOptions = {
    attempts: Number(process.env.BULLMQ_DEFAULT_ATTEMPTS || 4),
    backoff: {
        type: "exponential",
        delay: Number(process.env.BULLMQ_DEFAULT_BACKOFF_MS || 2000),
    },
    removeOnComplete: {
        count: Number(process.env.BULLMQ_REMOVE_ON_COMPLETE_COUNT || 1000),
    },
    removeOnFail: {
        count: Number(process.env.BULLMQ_REMOVE_ON_FAIL_COUNT || 5000),
    },
};

let posBackgroundQueue: Queue<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, string> | null = null;

export function getPosBackgroundQueue(): Queue<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, string> {
    if (!posBackgroundQueue) {
        posBackgroundQueue = new Queue<AnyPosBackgroundJobData, AnyPosBackgroundJobResult, string>(
            POS_BACKGROUND_QUEUE_NAME,
            {
                connection: getSharedBullMqConnection() as any,
                defaultJobOptions,
            }
        );
    }

    return posBackgroundQueue;
}
