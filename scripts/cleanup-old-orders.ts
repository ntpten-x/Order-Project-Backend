import { AppDataSource, connectDatabase } from "../src/database/database";
import {
    cleanupClosedOrdersOlderThan,
    cleanupOrderQueueOlderThan,
    DEFAULT_CLOSED_ORDER_STATUSES,
    DEFAULT_ORDER_QUEUE_RETENTION_DAYS,
    DEFAULT_ORDER_RETENTION_DAYS,
    DEFAULT_QUEUE_CLOSED_STATUSES,
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

async function main(): Promise<void> {
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

    console.log("[Retention] Cleanup closed orders started");
    console.log("[Retention] Config:", {
        retentionDays,
        statuses,
        batchSize: batchSize ?? "(default)",
        maxBatches: maxBatches ?? "(default)",
        enabled,
        dryRun,
        nodeEnv: process.env.NODE_ENV,
    });
    if (!enabled) {
        console.log("[Retention] ORDER_RETENTION_ENABLED is not true; running in dry-run mode (no deletes).");
    }
    if (!queueEnabled) {
        console.log("[Retention] ORDER_QUEUE_RETENTION_ENABLED is not true; queue cleanup will run in dry-run mode.");
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
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

main().catch((error) => {
    console.error("[Retention] Cleanup failed:", error);
    process.exitCode = 1;
});
