let client: any = null;
try {
    client = require("prom-client");
} catch (err) {
    if (process.env.METRICS_ENABLED === "true") {
        console.warn("[Metrics] prom-client not available. Install 'prom-client' to enable metrics.");
    }
}

const requestedMetrics = process.env.METRICS_ENABLED === "true";
const metricsEnabled = requestedMetrics && !!client;

let registry: any = null;
let httpRequestDuration: any = null;
let httpRequestTotal: any = null;
let errorTotal: any = null;

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

export const metrics = {
    enabled: metricsEnabled,
    contentType: metricsEnabled && registry ? registry.contentType : "text/plain; version=0.0.4; charset=utf-8",
    observeRequest: (params: { method: string; path: string; status: number; durationMs: number }) => {
        if (!metricsEnabled || !httpRequestDuration || !httpRequestTotal) return;
        httpRequestDuration.labels(params.method, params.path, String(params.status)).observe(params.durationMs);
        httpRequestTotal.labels(params.method, params.path, String(params.status)).inc();
    },
    countError: (type: string) => {
        if (!metricsEnabled || !errorTotal) return;
        errorTotal.labels(type).inc();
    },
    getMetrics: async () => (metricsEnabled && registry ? registry.metrics() : ""),
};
