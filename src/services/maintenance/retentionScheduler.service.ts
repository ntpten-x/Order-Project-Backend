import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { AppDataSource } from "../../database/database";
import {
    cleanupAuditLogsOlderThan,
    cleanupClosedOrdersOlderThan,
    cleanupCompletedStockOrdersOlderThan,
    DEFAULT_AUDIT_LOG_RETENTION_DAYS,
    DEFAULT_CLOSED_ORDER_STATUSES,
    DEFAULT_ORDER_RETENTION_DAYS,
    DEFAULT_STOCK_COMPLETED_STATUSES,
    DEFAULT_STOCK_ORDER_RETENTION_DAYS,
} from "./orderRetention.service";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
}

function parseIntOrUndefined(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.trunc(parsed);
}

function parseCsv(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    const values = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    return values.length > 0 ? values : undefined;
}

async function appendRetentionLog(payload: Record<string, unknown>): Promise<void> {
    const target = process.env.RETENTION_LOG_FILE || "logs/retention-jobs.log";
    const absolutePath = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await appendFile(absolutePath, `${JSON.stringify(payload)}\n`, "utf8");
}

class RetentionSchedulerService {
    private timer: NodeJS.Timeout | null = null;
    private inFlight = false;
    private started = false;

    private readonly enabled = parseBoolean(
        process.env.RETENTION_SCHEDULER_ENABLED,
        parseBoolean(process.env.ORDER_RETENTION_ENABLED, false) ||
            parseBoolean(process.env.STOCK_ORDER_RETENTION_ENABLED, false) ||
            parseBoolean(process.env.AUDIT_LOG_RETENTION_ENABLED, false)
    );
    private readonly initialDelayMs = Math.max(
        1_000,
        parseIntOrUndefined(process.env.RETENTION_SCHEDULER_INITIAL_DELAY_MS) ?? 60_000
    );
    private readonly intervalMs = Math.max(
        60_000,
        parseIntOrUndefined(process.env.RETENTION_SCHEDULER_INTERVAL_MS) ?? 6 * 60 * 60 * 1000
    );
    private readonly warnDeletedThreshold =
        parseIntOrUndefined(process.env.RETENTION_WARN_DELETED_TOTAL) ?? 5000;

    schedule(): void {
        if (!this.enabled || this.started) {
            return;
        }

        this.started = true;
        this.timer = setTimeout(() => {
            void this.runCycle();
            this.scheduleNextRun();
        }, this.initialDelayMs);

        if (typeof this.timer.unref === "function") {
            this.timer.unref();
        }
    }

    private scheduleNextRun(): void {
        this.timer = setInterval(() => {
            void this.runCycle();
        }, this.intervalMs);

        if (this.timer && typeof this.timer.unref === "function") {
            this.timer.unref();
        }
    }

    private async runCycle(): Promise<void> {
        if (this.inFlight) {
            return;
        }

        this.inFlight = true;
        const startedAt = Date.now();
        try {
            if (!AppDataSource.isInitialized) {
                throw new Error("database is not initialized");
            }

            const orderEnabled = parseBoolean(process.env.ORDER_RETENTION_ENABLED, false);
            const orderDryRun = !orderEnabled ? true : parseBoolean(process.env.ORDER_RETENTION_DRY_RUN, false);
            const orderResult = await cleanupClosedOrdersOlderThan({
                retentionDays: parseIntOrUndefined(process.env.ORDER_RETENTION_DAYS) ?? DEFAULT_ORDER_RETENTION_DAYS,
                statuses: parseCsv(process.env.ORDER_RETENTION_STATUSES) ?? DEFAULT_CLOSED_ORDER_STATUSES,
                batchSize: parseIntOrUndefined(process.env.ORDER_RETENTION_BATCH_SIZE),
                maxBatches: parseIntOrUndefined(process.env.ORDER_RETENTION_MAX_BATCHES),
                dryRun: orderDryRun,
            });

            const stockEnabled = parseBoolean(process.env.STOCK_ORDER_RETENTION_ENABLED, orderEnabled);
            const stockDryRun = !stockEnabled
                ? true
                : parseBoolean(process.env.STOCK_ORDER_RETENTION_DRY_RUN, orderDryRun);
            const stockResult = await cleanupCompletedStockOrdersOlderThan({
                retentionDays:
                    parseIntOrUndefined(process.env.STOCK_ORDER_RETENTION_DAYS) ?? DEFAULT_STOCK_ORDER_RETENTION_DAYS,
                statuses: parseCsv(process.env.STOCK_ORDER_RETENTION_STATUSES) ?? DEFAULT_STOCK_COMPLETED_STATUSES,
                batchSize: parseIntOrUndefined(process.env.STOCK_ORDER_RETENTION_BATCH_SIZE),
                maxBatches: parseIntOrUndefined(process.env.STOCK_ORDER_RETENTION_MAX_BATCHES),
                dryRun: stockDryRun,
            });

            const auditEnabled = parseBoolean(process.env.AUDIT_LOG_RETENTION_ENABLED, orderEnabled);
            const auditDryRun = !auditEnabled
                ? true
                : parseBoolean(process.env.AUDIT_LOG_RETENTION_DRY_RUN, orderDryRun);
            const auditResult = await cleanupAuditLogsOlderThan({
                retentionDays:
                    parseIntOrUndefined(process.env.AUDIT_LOG_RETENTION_DAYS) ?? DEFAULT_AUDIT_LOG_RETENTION_DAYS,
                batchSize: parseIntOrUndefined(process.env.AUDIT_LOG_RETENTION_BATCH_SIZE),
                maxBatches: parseIntOrUndefined(process.env.AUDIT_LOG_RETENTION_MAX_BATCHES),
                dryRun: auditDryRun,
            });

            const deletedTotal =
                orderResult.deleted.orders +
                orderResult.deleted.payments +
                orderResult.deleted.items +
                orderResult.deleted.details +
                stockResult.deleted.orders +
                stockResult.deleted.items +
                stockResult.deleted.details +
                auditResult.deleted;

            const summary = {
                ts: new Date().toISOString(),
                status: "success",
                durationMs: Date.now() - startedAt,
                deletedTotal,
                warnDeletedThreshold: this.warnDeletedThreshold,
                orders: orderResult,
                stockOrders: stockResult,
                auditLogs: auditResult,
            };

            if (deletedTotal >= this.warnDeletedThreshold) {
                console.warn(
                    `[RetentionScheduler] High deletion volume detected: ${deletedTotal} rows (threshold: ${this.warnDeletedThreshold})`
                );
            }

            await appendRetentionLog(summary);
        } catch (error) {
            await appendRetentionLog({
                ts: new Date().toISOString(),
                status: "failed",
                error: error instanceof Error ? error.message : String(error),
            });
            console.error("[RetentionScheduler] cycle failed:", error);
        } finally {
            this.inFlight = false;
        }
    }
}

export const retentionSchedulerService = new RetentionSchedulerService();
