import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../utils/monitoring';
import { AuthRequest } from './auth.middleware';
import { metrics } from '../utils/metrics';

const slowRequestThresholdMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 800);
const enableSlowRequestLog = process.env.ENABLE_SLOW_REQUEST_LOG === 'true';

/**
 * Performance monitoring middleware
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

        monitoringService.logMetric('http_request', duration, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
        });

        if (enableSlowRequestLog && duration >= slowRequestThresholdMs) {
            console.warn(
                `[SLOW_REQUEST] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration.toFixed(1)}ms`
            );
        }

        const routePath = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
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
