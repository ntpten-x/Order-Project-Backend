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
const globalMetricsStateKey = "__orderProjectMetricsState__";

let registry: any = null;
let httpRequestDuration: any = null;
let httpRequestTotal: any = null;
let errorTotal: any = null;
let cacheRequestTotal: any = null;
let permissionDecisionTotal: any = null;
let permissionCheckDuration: any = null;
let privilegeEventTotal: any = null;

if (metricsEnabled) {
    const globalState = ((globalThis as any)[globalMetricsStateKey] ??= {});

    if (!globalState.registry) {
        globalState.registry = new client.Registry();
        client.collectDefaultMetrics({ register: globalState.registry });

        globalState.httpRequestDuration = new client.Histogram({
            name: "http_request_duration_ms",
            help: "HTTP request duration in milliseconds",
            labelNames: ["method", "path", "status"],
            buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
            registers: [globalState.registry],
        });

        globalState.httpRequestTotal = new client.Counter({
            name: "http_requests_total",
            help: "Total number of HTTP requests",
            labelNames: ["method", "path", "status"],
            registers: [globalState.registry],
        });

        globalState.errorTotal = new client.Counter({
            name: "http_errors_total",
            help: "Total number of errors",
            labelNames: ["type"],
            registers: [globalState.registry],
        });

        globalState.cacheRequestTotal = new client.Counter({
            name: "app_cache_requests_total",
            help: "Total cache requests grouped by operation and result",
            labelNames: ["cache", "operation", "result", "source"],
            registers: [globalState.registry],
        });

        globalState.permissionDecisionTotal = new client.Counter({
            name: "permission_decisions_total",
            help: "Total permission check decisions by resource/action/scope",
            labelNames: ["resource", "action", "decision", "scope"],
            registers: [globalState.registry],
        });

        globalState.permissionCheckDuration = new client.Histogram({
            name: "permission_check_duration_ms",
            help: "Permission check duration in milliseconds",
            labelNames: ["resource", "action", "decision"],
            buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500],
            registers: [globalState.registry],
        });

        globalState.privilegeEventTotal = new client.Counter({
            name: "privilege_events_total",
            help: "Privilege-sensitive events such as offboarding cleanup",
            labelNames: ["event", "result"],
            registers: [globalState.registry],
        });
    }

    registry = globalState.registry;
    httpRequestDuration = globalState.httpRequestDuration;
    httpRequestTotal = globalState.httpRequestTotal;
    errorTotal = globalState.errorTotal;
    cacheRequestTotal = globalState.cacheRequestTotal;
    permissionDecisionTotal = globalState.permissionDecisionTotal;
    permissionCheckDuration = globalState.permissionCheckDuration;
    privilegeEventTotal = globalState.privilegeEventTotal;
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
    observeCache: (params: {
        cache: string;
        operation: string;
        result: "hit" | "miss";
        source?: "memory" | "redis" | "none";
    }) => {
        if (!metricsEnabled || !cacheRequestTotal) return;
        cacheRequestTotal
            .labels(
                params.cache,
                params.operation,
                params.result,
                params.source ?? "none"
            )
            .inc();
    },
    observePermissionCheck: (params: {
        resource: string;
        action: string;
        decision: "allow" | "deny";
        scope: string;
        durationMs: number;
    }) => {
        if (!metricsEnabled || !permissionDecisionTotal || !permissionCheckDuration) return;
        permissionDecisionTotal
            .labels(params.resource, params.action, params.decision, params.scope)
            .inc();
        permissionCheckDuration
            .labels(params.resource, params.action, params.decision)
            .observe(params.durationMs);
    },
    countPrivilegeEvent: (params: {
        event: "override_update" | "override_revoke_offboarding" | "access_review";
        result: "success" | "error";
    }) => {
        if (!metricsEnabled || !privilegeEventTotal) return;
        privilegeEventTotal.labels(params.event, params.result).inc();
    },
    getMetrics: async () => (metricsEnabled && registry ? registry.metrics() : ""),
};
