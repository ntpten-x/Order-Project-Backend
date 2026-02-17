import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../utils/monitoring';
import { AuthRequest } from './auth.middleware';
import { metrics } from '../utils/metrics';

const slowRequestThresholdMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 800);
const enableSlowRequestLog = process.env.ENABLE_SLOW_REQUEST_LOG === 'true';
const defaultSkipPaths = ["/health", "/metrics", "/csrf-token", "/system/health"];

function parsePathList(value: string | undefined): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizePath(pathValue: string): string {
    if (!pathValue) return "/";
    const trimmed = pathValue.trim();
    if (!trimmed) return "/";
    if (trimmed === "/") return "/";
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) || "/" : trimmed;
}

const configuredSkipPaths = parsePathList(process.env.MONITORING_SKIP_PATHS);
const monitoringSkipPaths = (configuredSkipPaths.length > 0 ? configuredSkipPaths : defaultSkipPaths).map((pathValue) =>
    normalizePath(pathValue)
);

function shouldSkipMonitoring(pathValue: string): boolean {
    const normalizedPath = normalizePath(pathValue);
    return monitoringSkipPaths.some((skipPath) => {
        if (skipPath === normalizedPath) return true;
        if (skipPath === "/") return normalizedPath === "/";
        return normalizedPath.startsWith(`${skipPath}/`);
    });
}

/**
 * Performance monitoring middleware
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
        const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;

        if (!shouldSkipMonitoring(req.path)) {
            monitoringService.logMetric('http_request', duration, {
                method: req.method,
                path: req.path,
                routePath,
                statusCode: res.statusCode,
            });
        }

        if (enableSlowRequestLog && duration >= slowRequestThresholdMs) {
            console.warn(
                `[SLOW_REQUEST] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(1)}ms`
            );
        }

        metrics.observeRequest({
            method: req.method,
            path: routePath,
            status: res.statusCode,
            durationMs: duration,
        });
    });

    next();
};

/**
 * Error tracking middleware
 */
export const errorTracking = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = (req as AuthRequest).user?.id;
    
    monitoringService.logError(err, {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
    }, userId);

    metrics.countError(err.name || 'Unknown');

    next(err);
};
