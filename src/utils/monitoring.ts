/**
 * Application Monitoring and Error Tracking
 * Provides centralized monitoring and error tracking utilities
 */

interface ErrorEvent {
    error: Error;
    context?: Record<string, any>;
    userId?: string;
    timestamp: Date;
}

interface PerformanceMetric {
    name: string;
    duration: number;
    metadata?: Record<string, any>;
    timestamp: Date;
}

type MetricFilterOptions = {
    name?: string;
    includePaths?: string[];
    excludePaths?: string[];
    limit?: number;
};

export type EndpointPerformanceStat = {
    method: string;
    path: string;
    requestCount: number;
    averageResponseMs: number;
    p95ResponseMs: number;
    p99ResponseMs: number;
    maxResponseMs: number;
    errorRatePercent: number;
};

type EndpointStatsOptions = MetricFilterOptions & {
    topN?: number;
    minSamples?: number;
    methods?: string[];
};

class MonitoringService {
    private errors: ErrorEvent[] = [];
    private metrics: PerformanceMetric[] = [];
    private readonly maxErrors = 1000;
    private readonly maxMetrics = 1000;
    private readonly enableMetricConsoleLog = process.env.ENABLE_MONITORING_METRIC_LOG === "true";

    private static normalizePath(pathValue: string): string {
        if (!pathValue) return "/";
        const trimmed = pathValue.trim();
        if (!trimmed) return "/";
        if (trimmed === "/") return "/";
        return trimmed.endsWith("/") ? trimmed.slice(0, -1) || "/" : trimmed;
    }

    private static pathMatches(targetPath: string, candidatePath: string): boolean {
        const normalizedTarget = MonitoringService.normalizePath(targetPath);
        const normalizedCandidate = MonitoringService.normalizePath(candidatePath);
        if (normalizedTarget === normalizedCandidate) return true;
        if (normalizedCandidate === "/") return normalizedTarget === "/";
        return normalizedTarget.startsWith(`${normalizedCandidate}/`);
    }

    private static calculatePercentile(sortedValues: number[], percentile: number): number {
        if (sortedValues.length === 0) return 0;
        const rank = Math.ceil((percentile / 100) * sortedValues.length) - 1;
        const index = Math.min(Math.max(rank, 0), sortedValues.length - 1);
        return sortedValues[index] ?? 0;
    }

    private filterMetrics(options?: MetricFilterOptions): PerformanceMetric[] {
        if (!options) return this.metrics;

        const includePaths = (options.includePaths ?? [])
            .map((pathValue) => MonitoringService.normalizePath(pathValue))
            .filter(Boolean);
        const excludePaths = (options.excludePaths ?? [])
            .map((pathValue) => MonitoringService.normalizePath(pathValue))
            .filter(Boolean);

        let filtered = this.metrics.filter((metric) => {
            if (options.name && metric.name !== options.name) {
                return false;
            }

            if (includePaths.length === 0 && excludePaths.length === 0) {
                return true;
            }

            const metricPathRaw = typeof metric.metadata?.path === "string" ? metric.metadata.path : "";
            const metricPath = MonitoringService.normalizePath(metricPathRaw);

            if (
                includePaths.length > 0 &&
                !includePaths.some((candidate) => MonitoringService.pathMatches(metricPath, candidate))
            ) {
                return false;
            }

            if (
                excludePaths.length > 0 &&
                excludePaths.some((candidate) => MonitoringService.pathMatches(metricPath, candidate))
            ) {
                return false;
            }

            return true;
        });

        if (options.limit && options.limit > 0) {
            filtered = filtered.slice(-options.limit);
        }

        return filtered;
    }

    /**
     * Log error for monitoring
     */
    logError(error: Error, context?: Record<string, any>, userId?: string): void {
        const errorEvent: ErrorEvent = {
            error,
            context,
            userId,
            timestamp: new Date(),
        };

        this.errors.push(errorEvent);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // In production, send to external service (Sentry, DataDog, etc.)
        if (process.env.NODE_ENV === 'production') {
            // Example: sendToSentry(errorEvent);
            console.error('[MONITORING] Error:', {
                message: error.message,
                stack: error.stack,
                context,
                userId,
            });
        } else {
            console.error('[MONITORING] Error:', errorEvent);
        }
    }

    /**
     * Log performance metric
     */
    logMetric(name: string, duration: number, metadata?: Record<string, any>): void {
        if (!Number.isFinite(duration) || duration < 0) {
            return;
        }

        const metric: PerformanceMetric = {
            name,
            duration,
            metadata,
            timestamp: new Date(),
        };

        this.metrics.push(metric);
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }

        // Optional debug logging only (disabled by default in production).
        if (this.enableMetricConsoleLog) {
            console.log("[MONITORING] Metric:", metric);
        }
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit: number = 100): ErrorEvent[] {
        return this.errors.slice(-limit);
    }

    /**
     * Get recent metrics
     */
    getRecentMetrics(limit: number = 100, options?: Omit<MetricFilterOptions, "limit">): PerformanceMetric[] {
        return this.filterMetrics({ ...options, limit });
    }

    /**
     * Get error statistics
     */
    getErrorStats(): {
        total: number;
        last24Hours: number;
        byType: Record<string, number>;
    } {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const last24HoursErrors = this.errors.filter(
            e => e.timestamp >= last24Hours
        );

        const byType: Record<string, number> = {};
        this.errors.forEach(e => {
            const type = e.error.name || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
        });

        return {
            total: this.errors.length,
            last24Hours: last24HoursErrors.length,
            byType,
        };
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        averageResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        sampleSize: number;
    };
    getPerformanceStats(options: MetricFilterOptions): {
        averageResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        sampleSize: number;
    };
    getPerformanceStats(options?: MetricFilterOptions): {
        averageResponseTime: number;
        p95ResponseTime: number;
        p99ResponseTime: number;
        sampleSize: number;
    } {
        const metrics = this.filterMetrics(options);
        if (metrics.length === 0) {
            return {
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                sampleSize: 0,
            };
        }

        const durations = metrics
            .map((metric) => metric.duration)
            .filter((duration) => Number.isFinite(duration) && duration >= 0)
            .sort((a, b) => a - b);

        if (durations.length === 0) {
            return {
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                sampleSize: 0,
            };
        }

        const average = durations.reduce((a, b) => a + b, 0) / durations.length;

        return {
            averageResponseTime: average,
            p95ResponseTime: MonitoringService.calculatePercentile(durations, 95),
            p99ResponseTime: MonitoringService.calculatePercentile(durations, 99),
            sampleSize: durations.length,
        };
    }

    getEndpointPerformanceStats(options?: EndpointStatsOptions): EndpointPerformanceStat[] {
        const topN = Math.max(1, Math.trunc(options?.topN ?? 5));
        const minSamples = Math.max(1, Math.trunc(options?.minSamples ?? 3));
        const metrics = this.filterMetrics(options);
        const allowedMethods = (options?.methods ?? [])
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean);

        const groups = new Map<
            string,
            {
                method: string;
                path: string;
                durations: number[];
                errorCount: number;
            }
        >();

        for (const metric of metrics) {
            const methodRaw = typeof metric.metadata?.method === "string" ? metric.metadata.method : "UNKNOWN";
            const method = methodRaw.trim().toUpperCase() || "UNKNOWN";
            if (allowedMethods.length > 0 && !allowedMethods.includes(method)) {
                continue;
            }
            const pathRaw =
                typeof metric.metadata?.routePath === "string"
                    ? metric.metadata.routePath
                    : typeof metric.metadata?.path === "string"
                        ? metric.metadata.path
                        : "/";
            const path = MonitoringService.normalizePath(pathRaw);
            const duration = Number(metric.duration);
            if (!Number.isFinite(duration) || duration < 0) {
                continue;
            }
            const statusCode = Number(metric.metadata?.statusCode);
            const hasError = Number.isFinite(statusCode) && statusCode >= 500;

            const key = `${method} ${path}`;
            const current = groups.get(key) ?? {
                method,
                path,
                durations: [],
                errorCount: 0,
            };
            current.durations.push(duration);
            if (hasError) current.errorCount += 1;
            groups.set(key, current);
        }

        const stats = Array.from(groups.values())
            .map((group) => {
                const sortedDurations = group.durations.sort((a, b) => a - b);
                const requestCount = sortedDurations.length;
                const averageResponseMs =
                    requestCount > 0
                        ? sortedDurations.reduce((sum, value) => sum + value, 0) / requestCount
                        : 0;
                const p95ResponseMs = MonitoringService.calculatePercentile(sortedDurations, 95);
                const p99ResponseMs = MonitoringService.calculatePercentile(sortedDurations, 99);
                const maxResponseMs = sortedDurations[requestCount - 1] ?? 0;
                const errorRatePercent =
                    requestCount > 0 ? (group.errorCount / requestCount) * 100 : 0;

                return {
                    method: group.method,
                    path: group.path,
                    requestCount,
                    averageResponseMs,
                    p95ResponseMs,
                    p99ResponseMs,
                    maxResponseMs,
                    errorRatePercent,
                };
            })
            .filter((item) => item.requestCount >= minSamples)
            .sort((a, b) => {
                if (b.p95ResponseMs !== a.p95ResponseMs) return b.p95ResponseMs - a.p95ResponseMs;
                if (b.p99ResponseMs !== a.p99ResponseMs) return b.p99ResponseMs - a.p99ResponseMs;
                if (b.averageResponseMs !== a.averageResponseMs) return b.averageResponseMs - a.averageResponseMs;
                return b.requestCount - a.requestCount;
            });

        return stats.slice(0, topN);
    }
}

// Singleton instance
export const monitoringService = new MonitoringService();

/**
 * Performance monitoring decorator
 */
export function monitorPerformance(name: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const start = process.hrtime.bigint();
            try {
                const result = await originalMethod.apply(this, args);
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
                monitoringService.logMetric(name, duration, {
                    method: propertyKey,
                    success: true,
                });
                return result;
            } catch (error) {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1_000_000;
                monitoringService.logMetric(name, duration, {
                    method: propertyKey,
                    success: false,
                });
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Error tracking middleware
 */
export function trackError(error: Error, context?: Record<string, any>, userId?: string): void {
    monitoringService.logError(error, context, userId);
}
