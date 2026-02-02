"use strict";
/**
 * Application Monitoring and Error Tracking
 * Provides centralized monitoring and error tracking utilities
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = void 0;
exports.monitorPerformance = monitorPerformance;
exports.trackError = trackError;
class MonitoringService {
    constructor() {
        this.errors = [];
        this.metrics = [];
        this.maxErrors = 1000;
        this.maxMetrics = 1000;
    }
    /**
     * Log error for monitoring
     */
    logError(error, context, userId) {
        const errorEvent = {
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
        }
        else {
            console.error('[MONITORING] Error:', errorEvent);
        }
    }
    /**
     * Log performance metric
     */
    logMetric(name, duration, metadata) {
        const metric = {
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
    getRecentErrors(limit = 100) {
        return this.errors.slice(-limit);
    }
    /**
     * Get recent metrics
     */
    getRecentMetrics(limit = 100) {
        return this.metrics.slice(-limit);
    }
    /**
     * Get error statistics
     */
    getErrorStats() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last24HoursErrors = this.errors.filter(e => e.timestamp >= last24Hours);
        const byType = {};
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
    getPerformanceStats() {
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
exports.monitoringService = new MonitoringService();
/**
 * Performance monitoring decorator
 */
function monitorPerformance(name) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            return __awaiter(this, void 0, void 0, function* () {
                const start = process.hrtime.bigint();
                try {
                    const result = yield originalMethod.apply(this, args);
                    const end = process.hrtime.bigint();
                    const duration = Number(end - start) / 1000000; // Convert to milliseconds
                    exports.monitoringService.logMetric(name, duration, {
                        method: propertyKey,
                        success: true,
                    });
                    return result;
                }
                catch (error) {
                    const end = process.hrtime.bigint();
                    const duration = Number(end - start) / 1000000;
                    exports.monitoringService.logMetric(name, duration, {
                        method: propertyKey,
                        success: false,
                    });
                    throw error;
                }
            });
        };
        return descriptor;
    };
}
/**
 * Error tracking middleware
 */
function trackError(error, context, userId) {
    exports.monitoringService.logError(error, context, userId);
}
