import { z } from "zod";
import { PosBackgroundJobNames } from "../../queues/posBackground.queue";

const uuid = z.string().uuid();
const jobId = z.string().min(1, "jobId is required");

const reportFiltersSchema = z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()])
).optional();

export const backgroundJobIdParamSchema = z.object({
    params: z.object({
        jobId,
    }),
});

export const createGenerateReportJobSchema = z.object({
    body: z.object({
        jobName: z.literal(PosBackgroundJobNames.GenerateReport).optional(),
        reportType: z.enum(["sales-summary", "inventory-audit", "custom"]),
        format: z.enum(["json", "csv", "pdf"]).optional(),
        filters: reportFiltersSchema,
    }).passthrough(),
});

export const createSyncStockJobSchema = z.object({
    body: z.object({
        jobName: z.literal(PosBackgroundJobNames.SyncStock).optional(),
        productId: uuid.optional(),
        reason: z.enum(["manual", "order-paid", "inventory-adjustment", "scheduled"]),
    }).passthrough(),
});
