import { Job } from "bullmq";
import { randomUUID } from "crypto";
import { GenerateReportJobData, GenerateReportJobResult, PosBackgroundJobNames } from "../posBackground.queue";

export async function processGenerateReport(
    job: Job<GenerateReportJobData, GenerateReportJobResult, PosBackgroundJobNames.GenerateReport>
): Promise<GenerateReportJobResult> {
    if (!job.data.reportType) {
        throw new Error("reportType is required");
    }

    if (!job.data.requestedByUserId) {
        throw new Error("requestedByUserId is required");
    }

    // Replace this stub with the real report pipeline (query aggregation, file export, storage upload).
    const generatedAt = new Date().toISOString();
    console.info("[BullMQ] Generating POS report", {
        jobId: job.id,
        reportType: job.data.reportType,
        branchId: job.data.branchId ?? null,
        format: job.data.format ?? "json",
    });

    return {
        reportId: randomUUID(),
        reportType: job.data.reportType,
        format: job.data.format ?? "json",
        generatedAt,
        status: "completed",
    };
}
