import os from "node:os";
import path from "node:path";
import { open } from "node:fs/promises";
import { AppDataSource } from "../database/database";
import { getRedisClient, isRedisConfigured } from "../lib/redisClient";
import { monitoringService } from "../utils/monitoring";
import { SocketService } from "./socket.service";

export type HealthLevel = "ok" | "warn" | "error";

export type HealthCheckItem = {
    key: string;
    title: string;
    level: HealthLevel;
    summary: string;
    checkedAt: string;
    latencyMs?: number;
    details?: Record<string, unknown>;
};

type IndexCheck = {
    table: string;
    columns: string[];
    matched: boolean;
    reason: string;
};

type RetentionLogSummary = {
    ts?: string;
    status?: string;
    durationMs?: number;
    deletedTotal?: number;
    orders?: Record<string, unknown>;
    queue?: Record<string, unknown>;
    stockOrders?: Record<string, unknown>;
    auditLogs?: Record<string, unknown>;
    error?: string;
};

export type SystemHealthReport = {
    overallLevel: HealthLevel;
    checkedAt: string;
    uptimeSeconds: number;
    environment: {
        nodeEnv: string;
        hostname: string;
        pid: number;
    };
    readiness: HealthCheckItem[];
    security: HealthCheckItem[];
    jobs: HealthCheckItem[];
    performance: {
        level: HealthLevel;
        summary: string;
        averageResponseMs: number;
        p95ResponseMs: number;
        p99ResponseMs: number;
        sampleSize: number;
        indexChecks: IndexCheck[];
    };
    integration: {
        frontendProxyPrefix: string;
        allowedFrontendOrigins: string[];
        corsCredentialsEnabled: boolean;
        backendApiPrefix: string;
        healthEndpoint: string;
        allowedProxyPaths: string[];
        authMode: string;
    };
    warnings: string[];
};

const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://13.239.29.168:3001",
];
const CSRF_EXCLUDED_PATHS = ["/auth/login", "/auth/logout", "/health", "/csrf-token", "/metrics"];
const DEFAULT_ALLOWED_PROXY_PATHS = [
    "/auth/*",
    "/permissions/*",
    "/users/*",
    "/branch/*",
    "/pos/*",
    "/stock/*",
    "/audit/*",
    "/system/*",
    "/health",
    "/metrics",
    "/csrf-token",
];

const LEVEL_RANK: Record<HealthLevel, number> = {
    ok: 0,
    warn: 1,
    error: 2,
};

function maxLevel(levels: HealthLevel[]): HealthLevel {
    let current: HealthLevel = "ok";
    for (const level of levels) {
        if (LEVEL_RANK[level] > LEVEL_RANK[current]) {
            current = level;
        }
    }
    return current;
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
}

function parseNumberEnv(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function resolveAllowedFrontendOrigins(): string[] {
    const values = [...DEFAULT_ALLOWED_ORIGINS, process.env.FRONTEND_URL || ""];
    return Array.from(
        new Set(
            values
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

function parseListEnv(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function resolveAllowedProxyPaths(): string[] {
    const fromEnv = parseListEnv(process.env.FRONTEND_ALLOWED_PROXY_PATHS);
    if (fromEnv.length > 0) return fromEnv;
    return DEFAULT_ALLOWED_PROXY_PATHS;
}

function resolveRetentionLogPath(): string {
    const configured = process.env.RETENTION_LOG_FILE || "logs/retention-jobs.log";
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

function toIsoNow(): string {
    return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

async function readLatestRetentionLogEntry(filePath: string): Promise<{
    exists: boolean;
    entry?: RetentionLogSummary;
    parseError?: string;
}> {
    try {
        const handle = await open(filePath, "r");
        try {
            const stats = await handle.stat();
            if (!stats.size) return { exists: true };

            const bytesToRead = Math.min(stats.size, 256 * 1024);
            const buffer = Buffer.alloc(bytesToRead);
            await handle.read(buffer, 0, bytesToRead, stats.size - bytesToRead);
            const lines = buffer
                .toString("utf8")
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);

            for (let index = lines.length - 1; index >= 0; index--) {
                try {
                    const parsed = JSON.parse(lines[index]) as RetentionLogSummary;
                    return { exists: true, entry: parsed };
                } catch {
                    continue;
                }
            }

            return { exists: true, parseError: "Retention log has no valid JSON entries" };
        } finally {
            await handle.close();
        }
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === "ENOENT") {
            return { exists: false };
        }
        return { exists: false, parseError: err.message };
    }
}

function buildRetentionJobCheck(params: {
    key: string;
    title: string;
    enabled: boolean;
    dryRun: boolean;
    retentionDays: number;
    checkedAt: string;
    staleHoursThreshold: number;
    lastRun?: RetentionLogSummary;
    entrySlice?: Record<string, unknown>;
    logPath: string;
}): HealthCheckItem {
    const lastRunAtRaw = asString(params.lastRun?.ts);
    const lastRunAtDate = lastRunAtRaw ? new Date(lastRunAtRaw) : undefined;
    const ageHours =
        lastRunAtDate && Number.isFinite(lastRunAtDate.getTime())
            ? Math.round(((Date.now() - lastRunAtDate.getTime()) / 3_600_000) * 10) / 10
            : undefined;

    let level: HealthLevel = "ok";
    let summary = "Running normally";

    if (!params.enabled) {
        level = "warn";
        summary = "Disabled (auto-cleanup not enabled)";
    } else if (params.dryRun) {
        level = "warn";
        summary = "Enabled in dry-run mode (no records deleted)";
    } else if (!params.lastRun) {
        level = "warn";
        summary = "No retention execution evidence found yet";
    } else if (params.lastRun.status === "failed") {
        level = "error";
        summary = "Last retention run failed";
    } else if (ageHours !== undefined && ageHours > params.staleHoursThreshold) {
        level = "warn";
        summary = `Last run is stale (${ageHours}h ago)`;
    }

    const candidateCount = asNumber(params.entrySlice?.candidateOrders ?? params.entrySlice?.candidateCount);
    const deletedCount = asNumber(params.entrySlice?.deleted);

    return {
        key: params.key,
        title: params.title,
        level,
        summary,
        checkedAt: params.checkedAt,
        details: {
            enabled: params.enabled,
            dryRun: params.dryRun,
            retentionDays: params.retentionDays,
            lastRunAt: lastRunAtRaw || null,
            lastRunAgeHours: ageHours ?? null,
            candidateCount: candidateCount ?? null,
            deletedCount: deletedCount ?? null,
            logPath: params.logPath,
            lastRunStatus: params.lastRun?.status ?? null,
            lastRunError: params.lastRun?.error ?? null,
        },
    };
}

function indexDefinitionIncludesColumns(indexDefinition: string, columns: string[]): boolean {
    const normalized = indexDefinition.toLowerCase().replace(/\s+/g, "");
    return columns.every((column) => normalized.includes(column.toLowerCase()));
}

export class SystemHealthService {
    async getReport(): Promise<SystemHealthReport> {
        const checkedAt = toIsoNow();
        const allowedFrontendOrigins = resolveAllowedFrontendOrigins();
        const allowedProxyPaths = resolveAllowedProxyPaths();
        const staleThresholdHours = parseNumberEnv(process.env.HEALTH_RETENTION_STALE_HOURS, 36);

        const readiness = await this.collectReadiness(checkedAt, allowedFrontendOrigins);
        const security = this.collectSecurity(checkedAt, allowedFrontendOrigins);
        const jobs = await this.collectRetentionJobs(checkedAt, staleThresholdHours);
        const performance = await this.collectPerformance();

        const overallLevel = maxLevel([
            ...readiness.map((item) => item.level),
            ...security.map((item) => item.level),
            ...jobs.map((item) => item.level),
            performance.level,
        ]);

        const warnings = [...readiness, ...security, ...jobs]
            .filter((item) => item.level !== "ok")
            .map((item) => `${item.title}: ${item.summary}`);
        if (performance.level !== "ok") {
            warnings.push(`Performance: ${performance.summary}`);
        }

        return {
            overallLevel,
            checkedAt,
            uptimeSeconds: Math.round(process.uptime()),
            environment: {
                nodeEnv: process.env.NODE_ENV || "development",
                hostname: os.hostname(),
                pid: process.pid,
            },
            readiness,
            security,
            jobs,
            performance,
            integration: {
                frontendProxyPrefix: "/api/*",
                allowedFrontendOrigins,
                corsCredentialsEnabled: true,
                backendApiPrefix: "/api",
                healthEndpoint: "/system/health",
                allowedProxyPaths,
                authMode: "JWT + Cookie + CSRF",
            },
            warnings,
        };
    }

    private async collectReadiness(
        checkedAt: string,
        allowedFrontendOrigins: string[]
    ): Promise<HealthCheckItem[]> {
        const checks: HealthCheckItem[] = [];

        const dbStartedAt = process.hrtime.bigint();
        try {
            if (!AppDataSource.isInitialized) {
                checks.push({
                    key: "database",
                    title: "PostgreSQL Database",
                    level: "error",
                    summary: "Database is not initialized",
                    checkedAt,
                    details: { initialized: false },
                });
            } else {
                await AppDataSource.query("SELECT 1");
                const latencyMs = Number(process.hrtime.bigint() - dbStartedAt) / 1_000_000;
                checks.push({
                    key: "database",
                    title: "PostgreSQL Database",
                    level: "ok",
                    summary: "Connection successful",
                    checkedAt,
                    latencyMs: Number(latencyMs.toFixed(2)),
                    details: { initialized: true },
                });
            }
        } catch (error) {
            checks.push({
                key: "database",
                title: "PostgreSQL Database",
                level: "error",
                summary: "Connection failed",
                checkedAt,
                details: {
                    initialized: AppDataSource.isInitialized,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
        }

        const redisStartedAt = process.hrtime.bigint();
        if (!isRedisConfigured()) {
            checks.push({
                key: "redis",
                title: "Redis Session Store",
                level: "warn",
                summary: "Redis is not configured",
                checkedAt,
                details: { configured: false },
            });
        } else {
            try {
                const redis = await getRedisClient();
                if (!redis) {
                    checks.push({
                        key: "redis",
                        title: "Redis Session Store",
                        level: "error",
                        summary: "Redis configured but not connected",
                        checkedAt,
                        details: { configured: true, connected: false },
                    });
                } else {
                    const pong = await redis.ping();
                    const latencyMs = Number(process.hrtime.bigint() - redisStartedAt) / 1_000_000;
                    checks.push({
                        key: "redis",
                        title: "Redis Session Store",
                        level: "ok",
                        summary: "Connection successful",
                        checkedAt,
                        latencyMs: Number(latencyMs.toFixed(2)),
                        details: { configured: true, connected: true, ping: pong },
                    });
                }
            } catch (error) {
                checks.push({
                    key: "redis",
                    title: "Redis Session Store",
                    level: "error",
                    summary: "Redis ping failed",
                    checkedAt,
                    details: {
                        configured: true,
                        connected: false,
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        }

        const socketHealth = SocketService.getInstance().getHealthSnapshot();
        checks.push({
            key: "socket",
            title: "Realtime Socket",
            level: socketHealth.initialized ? "ok" : "warn",
            summary: socketHealth.initialized
                ? "Socket.IO is initialized"
                : "Socket.IO has not been initialized yet",
            checkedAt,
            details: {
                initialized: socketHealth.initialized,
                connectedClients: socketHealth.connectedClients,
                redisAdapterEnabled: socketHealth.redisAdapterEnabled,
                redisAdapterReady: socketHealth.redisAdapterReady,
            },
        });

        checks.push({
            key: "frontend-cors",
            title: "Frontend Access (CORS)",
            level: allowedFrontendOrigins.length > 0 ? "ok" : "warn",
            summary:
                allowedFrontendOrigins.length > 0
                    ? "Frontend origins are configured"
                    : "No frontend origins configured",
            checkedAt,
            details: {
                allowedOrigins: allowedFrontendOrigins,
                credentials: true,
            },
        });

        return checks;
    }

    private collectSecurity(checkedAt: string, allowedFrontendOrigins: string[]): HealthCheckItem[] {
        const rateLimitRedisDisabled = process.env.RATE_LIMIT_REDIS_DISABLED === "true";
        const distributedRateLimitConfigured = Boolean(
            process.env.RATE_LIMIT_REDIS_URL || process.env.REDIS_URL
        );
        const jwtConfigured = Boolean(process.env.JWT_SECRET);

        return [
            {
                key: "helmet",
                title: "Helmet Security Headers",
                level: "ok",
                summary: "Enabled",
                checkedAt,
                details: { enabled: true },
            },
            {
                key: "csrf",
                title: "CSRF Protection",
                level: "ok",
                summary: "Cookie-based CSRF is enabled for state-changing requests",
                checkedAt,
                details: {
                    enabled: true,
                    excludedPaths: CSRF_EXCLUDED_PATHS,
                    mode: "cookie-auth state-changing methods",
                },
            },
            {
                key: "jwt",
                title: "JWT Token Validation",
                level: jwtConfigured ? "ok" : "error",
                summary: jwtConfigured ? "JWT secret configured" : "JWT secret is missing",
                checkedAt,
                details: {
                    jwtSecretConfigured: jwtConfigured,
                    sessionStoreExpected: isRedisConfigured(),
                },
            },
            {
                key: "rate-limit",
                title: "Rate Limiting",
                level: rateLimitRedisDisabled
                    ? "warn"
                    : distributedRateLimitConfigured
                        ? "ok"
                        : "warn",
                summary: rateLimitRedisDisabled
                    ? "Enabled with in-memory fallback (distributed mode disabled)"
                    : distributedRateLimitConfigured
                        ? "Enabled with Redis-backed distributed mode"
                        : "Enabled with in-memory fallback",
                checkedAt,
                details: {
                    enabled: true,
                    distributedConfigured: distributedRateLimitConfigured,
                    redisDisabled: rateLimitRedisDisabled,
                },
            },
            {
                key: "input-sanitize",
                title: "Input Sanitization",
                level: "ok",
                summary: "Enabled for body and query payloads",
                checkedAt,
                details: {
                    enabled: true,
                    skipPaths: ["/health", "/metrics", "/csrf-token"],
                },
            },
            {
                key: "cors",
                title: "CORS Restriction",
                level: allowedFrontendOrigins.length > 0 ? "ok" : "warn",
                summary:
                    allowedFrontendOrigins.length > 0
                        ? "Allowed origins list is configured"
                        : "Allowed origins list is empty",
                checkedAt,
                details: {
                    allowedOrigins: allowedFrontendOrigins,
                    credentials: true,
                },
            },
        ];
    }

    private async collectRetentionJobs(
        checkedAt: string,
        staleThresholdHours: number
    ): Promise<HealthCheckItem[]> {
        const orderEnabled = parseBooleanEnv(process.env.ORDER_RETENTION_ENABLED, false);
        const orderDryRun = !orderEnabled ? true : parseBooleanEnv(process.env.ORDER_RETENTION_DRY_RUN, false);
        const orderDays = Math.trunc(parseNumberEnv(process.env.ORDER_RETENTION_DAYS, 30));

        const stockEnabled = parseBooleanEnv(process.env.STOCK_ORDER_RETENTION_ENABLED, orderEnabled);
        const stockDryRun = !stockEnabled
            ? true
            : parseBooleanEnv(process.env.STOCK_ORDER_RETENTION_DRY_RUN, orderDryRun);
        const stockDays = Math.trunc(parseNumberEnv(process.env.STOCK_ORDER_RETENTION_DAYS, 7));

        const auditEnabled = parseBooleanEnv(process.env.AUDIT_LOG_RETENTION_ENABLED, orderEnabled);
        const auditDryRun = !auditEnabled
            ? true
            : parseBooleanEnv(process.env.AUDIT_LOG_RETENTION_DRY_RUN, orderDryRun);
        const auditDays = Math.trunc(parseNumberEnv(process.env.AUDIT_LOG_RETENTION_DAYS, 7));

        const logPath = resolveRetentionLogPath();
        const retentionLog = await readLatestRetentionLogEntry(logPath);
        const lastRun = retentionLog.entry;
        const heartbeatAt = asString(lastRun?.ts);
        const heartbeatDate = heartbeatAt ? new Date(heartbeatAt) : null;
        const heartbeatAgeHours =
            heartbeatDate && Number.isFinite(heartbeatDate.getTime())
                ? Number(((Date.now() - heartbeatDate.getTime()) / 3_600_000).toFixed(1))
                : null;
        const anyRetentionEnabled = orderEnabled || stockEnabled || auditEnabled;

        const schedulerLevel: HealthLevel = !anyRetentionEnabled
            ? "warn"
            : !heartbeatAt
                ? "warn"
                : lastRun?.status === "failed"
                    ? "error"
                    : heartbeatAgeHours !== null && heartbeatAgeHours > staleThresholdHours
                        ? "warn"
                        : "ok";

        const schedulerSummary =
            schedulerLevel === "ok"
                ? "Heartbeat detected and scheduler is active"
                : !anyRetentionEnabled
                    ? "Retention scheduler is disabled by configuration"
                    : !heartbeatAt
                        ? "No heartbeat evidence found yet"
                        : lastRun?.status === "failed"
                            ? "Last retention cycle failed"
                            : `Heartbeat is stale (${heartbeatAgeHours}h ago)`;

        return [
            {
                key: "scheduler-heartbeat",
                title: "Cron Scheduler Heartbeat",
                level: schedulerLevel,
                summary: schedulerSummary,
                checkedAt,
                details: {
                    anyRetentionEnabled,
                    staleThresholdHours,
                    lastRunAt: heartbeatAt || null,
                    lastRunStatus: lastRun?.status ?? null,
                    lastRunError: lastRun?.error ?? null,
                    lastRunAgeHours: heartbeatAgeHours,
                    logPath,
                },
            },
            buildRetentionJobCheck({
                key: "retention-pos",
                title: "POS Order Retention (30 days)",
                enabled: orderEnabled,
                dryRun: orderDryRun,
                retentionDays: orderDays,
                checkedAt,
                staleHoursThreshold: staleThresholdHours,
                lastRun,
                entrySlice: asRecord(lastRun?.orders) || undefined,
                logPath,
            }),
            buildRetentionJobCheck({
                key: "retention-stock",
                title: "Stock Order Retention (7 days)",
                enabled: stockEnabled,
                dryRun: stockDryRun,
                retentionDays: stockDays,
                checkedAt,
                staleHoursThreshold: staleThresholdHours,
                lastRun,
                entrySlice: asRecord(lastRun?.stockOrders) || undefined,
                logPath,
            }),
            buildRetentionJobCheck({
                key: "retention-audit",
                title: "Audit Retention (7 days)",
                enabled: auditEnabled,
                dryRun: auditDryRun,
                retentionDays: auditDays,
                checkedAt,
                staleHoursThreshold: staleThresholdHours,
                lastRun,
                entrySlice: asRecord(lastRun?.auditLogs) || undefined,
                logPath,
            }),
        ];
    }

    private async collectPerformance(): Promise<SystemHealthReport["performance"]> {
        const averageResponseMs = Number(monitoringService.getPerformanceStats().averageResponseTime.toFixed(2));
        const p95ResponseMs = Number(monitoringService.getPerformanceStats().p95ResponseTime.toFixed(2));
        const p99ResponseMs = Number(monitoringService.getPerformanceStats().p99ResponseTime.toFixed(2));
        const sampleSize = monitoringService.getRecentMetrics(500).length;

        const p95WarnMs = parseNumberEnv(process.env.HEALTH_P95_WARN_MS, 250);
        const p99WarnMs = parseNumberEnv(process.env.HEALTH_P99_WARN_MS, 500);

        let level: HealthLevel = "ok";
        let summary = "Response time is within guard thresholds";
        if (sampleSize === 0) {
            level = "warn";
            summary = "No response-time samples collected yet";
        } else if (p95ResponseMs > p95WarnMs || p99ResponseMs > p99WarnMs) {
            level = "warn";
            summary = `Latency exceeds threshold (p95>${p95WarnMs}ms or p99>${p99WarnMs}ms)`;
        }

        const indexChecks = await this.collectIndexChecks();
        if (indexChecks.some((item) => !item.matched) && level === "ok") {
            level = "warn";
            summary = "Some expected database indexes are missing";
        }

        return {
            level,
            summary,
            averageResponseMs,
            p95ResponseMs,
            p99ResponseMs,
            sampleSize,
            indexChecks,
        };
    }

    private async collectIndexChecks(): Promise<IndexCheck[]> {
        const expectations: Array<{ table: string; columns: string[]; reason: string }> = [
            {
                table: "sales_orders",
                columns: ["branch_id", "status", "create_date"],
                reason: "POS order list + dashboard filters",
            },
            {
                table: "order_queue",
                columns: ["status", "created_at"],
                reason: "Kitchen queue filtering",
            },
            {
                table: "payments",
                columns: ["order_id", "status"],
                reason: "Payment lookup and reconciliation",
            },
            {
                table: "stock_orders",
                columns: ["status", "create_date"],
                reason: "Stock order retention cleanup",
            },
            {
                table: "audit_logs",
                columns: ["created_at"],
                reason: "Audit retention cleanup and timeline queries",
            },
        ];

        if (!AppDataSource.isInitialized) {
            return expectations.map((item) => ({
                table: item.table,
                columns: item.columns,
                matched: false,
                reason: `${item.reason} (database not initialized)`,
            }));
        }

        try {
            const tables = expectations.map((item) => item.table);
            const rows = (await AppDataSource.query(
                `
                    SELECT tablename, indexname, indexdef
                    FROM pg_indexes
                    WHERE schemaname = 'public'
                      AND tablename = ANY($1::text[])
                `,
                [tables]
            )) as Array<{ tablename: string; indexname: string; indexdef: string }>;

            return expectations.map((item) => {
                const indexDefs = rows
                    .filter((row) => row.tablename === item.table)
                    .map((row) => row.indexdef);
                const matched = indexDefs.some((indexDef) =>
                    indexDefinitionIncludesColumns(indexDef, item.columns)
                );

                return {
                    table: item.table,
                    columns: item.columns,
                    matched,
                    reason: item.reason,
                };
            });
        } catch (error) {
            return expectations.map((item) => ({
                table: item.table,
                columns: item.columns,
                matched: false,
                reason: `${item.reason} (index check failed: ${
                    error instanceof Error ? error.message : String(error)
                })`,
            }));
        }
    }
}
