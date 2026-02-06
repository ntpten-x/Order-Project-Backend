"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../src/database/database");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const orderRetention_service_1 = require("../src/services/maintenance/orderRetention.service");
function parseBoolean(value, fallback) {
    if (value === undefined)
        return fallback;
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(v))
        return true;
    if (["0", "false", "no", "n", "off"].includes(v))
        return false;
    return fallback;
}
function parseCsv(value) {
    if (!value)
        return undefined;
    const items = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return items.length > 0 ? items : undefined;
}
function parseIntOrUndefined(value) {
    if (!value)
        return undefined;
    const n = Number(value);
    if (!Number.isFinite(n))
        return undefined;
    return Math.trunc(n);
}
function appendRetentionLog(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        const target = process.env.RETENTION_LOG_FILE || "logs/retention-jobs.log";
        const absolutePath = node_path_1.default.isAbsolute(target) ? target : node_path_1.default.join(process.cwd(), target);
        yield (0, promises_1.mkdir)(node_path_1.default.dirname(absolutePath), { recursive: true });
        yield (0, promises_1.appendFile)(absolutePath, `${JSON.stringify(payload)}\n`, "utf8");
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const startedAt = Date.now();
        const retentionDays = (_a = parseIntOrUndefined(process.env.ORDER_RETENTION_DAYS)) !== null && _a !== void 0 ? _a : orderRetention_service_1.DEFAULT_ORDER_RETENTION_DAYS;
        const statuses = (_b = parseCsv(process.env.ORDER_RETENTION_STATUSES)) !== null && _b !== void 0 ? _b : orderRetention_service_1.DEFAULT_CLOSED_ORDER_STATUSES;
        const batchSize = parseIntOrUndefined(process.env.ORDER_RETENTION_BATCH_SIZE);
        const maxBatches = parseIntOrUndefined(process.env.ORDER_RETENTION_MAX_BATCHES);
        const enabled = parseBoolean(process.env.ORDER_RETENTION_ENABLED, false);
        const dryRun = !enabled ? true : parseBoolean(process.env.ORDER_RETENTION_DRY_RUN, false);
        const queueEnabled = parseBoolean(process.env.ORDER_QUEUE_RETENTION_ENABLED, false);
        const queueDryRun = !queueEnabled ? true : parseBoolean(process.env.ORDER_QUEUE_RETENTION_DRY_RUN, false);
        const queueDays = (_c = parseIntOrUndefined(process.env.ORDER_QUEUE_RETENTION_DAYS)) !== null && _c !== void 0 ? _c : orderRetention_service_1.DEFAULT_ORDER_QUEUE_RETENTION_DAYS;
        const queueStatuses = (_d = parseCsv(process.env.ORDER_QUEUE_RETENTION_STATUSES)) !== null && _d !== void 0 ? _d : orderRetention_service_1.DEFAULT_QUEUE_CLOSED_STATUSES;
        const warnDeletedThreshold = (_e = parseIntOrUndefined(process.env.RETENTION_WARN_DELETED_TOTAL)) !== null && _e !== void 0 ? _e : 5000;
        console.log("[Retention] Cleanup closed orders started");
        console.log("[Retention] Config:", {
            retentionDays,
            statuses,
            batchSize: batchSize !== null && batchSize !== void 0 ? batchSize : "(default)",
            maxBatches: maxBatches !== null && maxBatches !== void 0 ? maxBatches : "(default)",
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
        yield (0, database_1.connectDatabase)();
        try {
            const result = yield (0, orderRetention_service_1.cleanupClosedOrdersOlderThan)({
                retentionDays,
                statuses,
                batchSize,
                maxBatches,
                dryRun,
            });
            console.log("[Retention] Result:", result);
            const queueResult = yield (0, orderRetention_service_1.cleanupOrderQueueOlderThan)({
                retentionDays: queueDays,
                statuses: queueStatuses,
                dryRun: queueDryRun,
            });
            console.log("[Retention] Queue Result:", queueResult);
            const deletedTotal = result.deleted.orders +
                result.deleted.orderQueue +
                result.deleted.payments +
                result.deleted.items +
                result.deleted.details +
                queueResult.deleted;
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
            };
            console.log("[Retention][Summary]", JSON.stringify(summary));
            yield appendRetentionLog(summary);
        }
        finally {
            if (database_1.AppDataSource.isInitialized) {
                yield database_1.AppDataSource.destroy();
            }
        }
    });
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
