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

class MonitoringService {
    private errors: ErrorEvent[] = [];
    private metrics: PerformanceMetric[] = [];
    private readonly maxErrors = 1000;
    private readonly maxMetrics = 1000;

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

        // In production, send to external service
        if (process.env.NODE_ENV === 'production') {
            // Example: sendToDataDog(metric);
            console.log('[MONITORING] Metric:', metric);
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
    getRecentMetrics(limit: number = 100): PerformanceMetric[] {
        return this.metrics.slice(-limit);
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
    } {
        if (this.metrics.length === 0) {
            return {
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
            };
        }

        const durations = this.metrics.map(m => m.duration).sort((a, b) => a - b);
        const average = durations.reduce((a, b) => a + b, 0) / durations.length;
        const p95Index = Math.floor(durations.length * 0.95);
        const p99Index = Math.floor(durations.length * 0.99);

        return {
            averageResponseTime: average,
            p95ResponseTime: durations[p95Index] || 0,
            p99ResponseTime: durations[p99Index] || 0,
        };
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
