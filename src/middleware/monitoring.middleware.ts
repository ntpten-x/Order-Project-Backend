import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../utils/monitoring';
import { AuthRequest } from './auth.middleware';

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

    next(err);
};
