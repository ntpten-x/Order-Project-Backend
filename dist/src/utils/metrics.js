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
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
let client = null;
try {
    client = require("prom-client");
}
catch (err) {
    if (process.env.METRICS_ENABLED === "true") {
        console.warn("[Metrics] prom-client not available. Install 'prom-client' to enable metrics.");
    }
}
const requestedMetrics = process.env.METRICS_ENABLED === "true";
const metricsEnabled = requestedMetrics && !!client;
let registry = null;
let httpRequestDuration = null;
let httpRequestTotal = null;
let errorTotal = null;
if (metricsEnabled) {
    registry = new client.Registry();
    client.collectDefaultMetrics({ register: registry });
    httpRequestDuration = new client.Histogram({
        name: "http_request_duration_ms",
        help: "HTTP request duration in milliseconds",
        labelNames: ["method", "path", "status"],
        buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    });
    httpRequestTotal = new client.Counter({
        name: "http_requests_total",
        help: "Total number of HTTP requests",
        labelNames: ["method", "path", "status"],
    });
    errorTotal = new client.Counter({
        name: "http_errors_total",
        help: "Total number of errors",
        labelNames: ["type"],
    });
    registry.registerMetric(httpRequestDuration);
    registry.registerMetric(httpRequestTotal);
    registry.registerMetric(errorTotal);
}
exports.metrics = {
    enabled: metricsEnabled,
    contentType: metricsEnabled && registry ? registry.contentType : "text/plain; version=0.0.4; charset=utf-8",
    observeRequest: (params) => {
        if (!metricsEnabled || !httpRequestDuration || !httpRequestTotal)
            return;
        httpRequestDuration.labels(params.method, params.path, String(params.status)).observe(params.durationMs);
        httpRequestTotal.labels(params.method, params.path, String(params.status)).inc();
    },
    countError: (type) => {
        if (!metricsEnabled || !errorTotal)
            return;
        errorTotal.labels(type).inc();
    },
    getMetrics: () => __awaiter(void 0, void 0, void 0, function* () { return (metricsEnabled && registry ? registry.metrics() : ""); }),
};
