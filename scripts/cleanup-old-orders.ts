import { AppDataSource, connectDatabase } from "../src/database/database";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
    cleanupAuditLogsOlderThan,
    cleanupCompletedStockOrdersOlderThan,
    cleanupClosedOrdersOlderThan,
    cleanupOrderQueueOlderThan,
    DEFAULT_AUDIT_LOG_RETENTION_DAYS,
    DEFAULT_CLOSED_ORDER_STATUSES,
    DEFAULT_ORDER_QUEUE_RETENTION_DAYS,
    DEFAULT_ORDER_RETENTION_DAYS,
    DEFAULT_QUEUE_CLOSED_STATUSES,
    DEFAULT_STOCK_COMPLETED_STATUSES,
    DEFAULT_STOCK_ORDER_RETENTION_DAYS,
} from "../src/services/maintenance/orderRetention.service";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(v)) return true;
    if (["0", "false", "no", "n", "off"].includes(v)) return false;
    return fallback;
}

function parseCsv(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const items = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return items.length > 0 ? items : undefined;
}

function parseIntOrUndefined(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.trunc(n);
}

async function appendRetentionLog(payload: Record<string, unknown>): Promise<void> {
    const target = process.env.RETENTION_LOG_FILE || "logs/retention-jobs.log";
    const absolutePath = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await appendFile(absolutePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function main(): Promise<void> {
    const startedAt = Date.now();
    const retentionDays = parseIntOrUndefined(process.env.ORDER_RETENTION_DAYS) ?? DEFAULT_ORDER_RETENTION_DAYS;
    const statuses = parseCsv(process.env.ORDER_RETENTION_STATUSES) ?? DEFAULT_CLOSED_ORDER_STATUSES;
    const batchSize = parseIntOrUndefined(process.env.ORDER_RETENTION_BATCH_SIZE);
    const maxBatches = parseIntOrUndefined(process.env.ORDER_RETENTION_MAX_BATCHES);
    const enabled = parseBoolean(process.env.ORDER_RETENTION_ENABLED, false);
    const dryRun = !enabled ? true : parseBoolean(process.env.ORDER_RETENTION_DRY_RUN, false);

    const queueEnabled = parseBoolean(process.env.ORDER_QUEUE_RETENTION_ENABLED, false);
    const queueDryRun = !queueEnabled ? true : parseBoolean(process.env.ORDER_QUEUE_RETENTION_DRY_RUN, false);
    const queueDays = parseIntOrUndefined(process.env.ORDER_QUEUE_RETENTION_DAYS) ?? DEFAULT_ORDER_QUEUE_RETENTION_DAYS;
    const queueStatuses = parseCsv(process.env.ORDER_QUEUE_RETENTION_STATUSES) ?? DEFAULT_QUEUE_CLOSED_STATUSES;

    const stockEnabled = parseBoolean(process.env.STOCK_ORDER_RETENTION_ENABLED, enabled);
    const stockDryRun = !stockEnabled ? true : parseBoolean(process.env.STOCK_ORDER_RETENTION_DRY_RUN, dryRun);
    const stockDays = parseIntOrUndefined(process.env.STOCK_ORDER_RETENTION_DAYS) ?? DEFAULT_STOCK_ORDER_RETENTION_DAYS;
    const stockStatuses = parseCsv(process.env.STOCK_ORDER_RETENTION_STATUSES) ?? DEFAULT_STOCK_COMPLETED_STATUSES;
    const stockBatchSize = parseIntOrUndefined(process.env.STOCK_ORDER_RETENTION_BATCH_SIZE);
    const stockMaxBatches = parseIntOrUndefined(process.env.STOCK_ORDER_RETENTION_MAX_BATCHES);

    const auditEnabled = parseBoolean(process.env.AUDIT_LOG_RETENTION_ENABLED, enabled);
    const auditDryRun = !auditEnabled ? true : parseBoolean(process.env.AUDIT_LOG_RETENTION_DRY_RUN, dryRun);
    const auditDays = parseIntOrUndefined(process.env.AUDIT_LOG_RETENTION_DAYS) ?? DEFAULT_AUDIT_LOG_RETENTION_DAYS;
    const auditBatchSize = parseIntOrUndefined(process.env.AUDIT_LOG_RETENTION_BATCH_SIZE);
    const auditMaxBatches = parseIntOrUndefined(process.env.AUDIT_LOG_RETENTION_MAX_BATCHES);
    const warnDeletedThreshold = parseIntOrUndefined(process.env.RETENTION_WARN_DELETED_TOTAL) ?? 5000;

    console.log("[Retention] Cleanup closed orders started");
    console.log("[Retention] Config:", {
        retentionDays,
        statuses,
        batchSize: batchSize ?? "(default)",
        maxBatches: maxBatches ?? "(default)",
        enabled,
        dryRun,
        stockRetentionDays: stockDays,
        stockStatuses,
        stockBatchSize: stockBatchSize ?? "(default)",
        stockMaxBatches: stockMaxBatches ?? "(default)",
        stockEnabled,
        stockDryRun,
        auditRetentionDays: auditDays,
        auditBatchSize: auditBatchSize ?? "(default)",
        auditMaxBatches: auditMaxBatches ?? "(default)",
        auditEnabled,
        auditDryRun,
        nodeEnv: process.env.NODE_ENV,
    });
    if (!enabled) {
        console.log("[Retention] ORDER_RETENTION_ENABLED is not true; running in dry-run mode (no deletes).");
    }
    if (!queueEnabled) {
        console.log("[Retention] ORDER_QUEUE_RETENTION_ENABLED is not true; queue cleanup will run in dry-run mode.");
    }
    if (!stockEnabled) {
        console.log("[Retention] STOCK_ORDER_RETENTION_ENABLED is not true; stock order cleanup will run in dry-run mode.");
    }
    if (!auditEnabled) {
        console.log("[Retention] AUDIT_LOG_RETENTION_ENABLED is not true; audit log cleanup will run in dry-run mode.");
    }

    await connectDatabase();

    try {
        const result = await cleanupClosedOrdersOlderThan({
            retentionDays,
            statuses,
            batchSize,
            maxBatches,
            dryRun,
        });

        console.log("[Retention] Result:", result);

        const queueResult = await cleanupOrderQueueOlderThan({
            retentionDays: queueDays,
            statuses: queueStatuses,
            dryRun: queueDryRun,
        });
        console.log("[Retention] Queue Result:", queueResult);

        const stockResult = await cleanupCompletedStockOrdersOlderThan({
            retentionDays: stockDays,
            statuses: stockStatuses,
            batchSize: stockBatchSize,
            maxBatches: stockMaxBatches,
            dryRun: stockDryRun,
        });
        console.log("[Retention] Stock Result:", stockResult);

        const auditResult = await cleanupAuditLogsOlderThan({
            retentionDays: auditDays,
            batchSize: auditBatchSize,
            maxBatches: auditMaxBatches,
            dryRun: auditDryRun,
        });
        console.log("[Retention] Audit Result:", auditResult);

        const deletedTotal =
            result.deleted.orders +
            result.deleted.orderQueue +
            result.deleted.payments +
            result.deleted.items +
            result.deleted.details +
            queueResult.deleted +
            stockResult.deleted.orders +
            stockResult.deleted.items +
            stockResult.deleted.details +
            auditResult.deleted;
        const durationMs = Date.now() - startedAt;

        if (deletedTotal >= warnDeletedThreshold) {
            console.warn(`[Retention] High deletion volume detected: ${deletedTotal} rows (threshold: ${warnDeletedThreshold})`);
        }

        const summary = {
            ts: new Date().toISOString(),
            status: "success",
            durationMs,
            deletedTotal,
            warnDeletedThreshold,
            orders: result,
            queue: queueResult,
            stockOrders: stockResult,
            auditLogs: auditResult,
        };
        console.log("[Retention][Summary]", JSON.stringify(summary));
        await appendRetentionLog(summary);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

main().catch((error) => {
    console.error("[Retention] Cleanup failed:", error);
    void appendRetentionLog({
        ts: new Date().toISOString(),
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
});
