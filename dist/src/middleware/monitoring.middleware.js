"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTracking = exports.performanceMonitoring = void 0;
const monitoring_1 = require("../utils/monitoring");
const metrics_1 = require("../utils/metrics");
/**
 * Performance monitoring middleware
 */
const performanceMonitoring = (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        var _a;
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        monitoring_1.monitoringService.logMetric('http_request', duration, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
        });
        const routePath = ((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) ? `${req.baseUrl}${req.route.path}` : req.path;
        metrics_1.metrics.observeRequest({
            method: req.method,
            path: routePath,
            status: res.statusCode,
            durationMs: duration,
        });
    });
    next();
};
exports.performanceMonitoring = performanceMonitoring;
/**
 * Error tracking middleware
 */
const errorTracking = (err, req, res, next) => {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    monitoring_1.monitoringService.logError(err, {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
    }, userId);
    metrics_1.metrics.countError(err.name || 'Unknown');
    next(err);
};
exports.errorTracking = errorTracking;
