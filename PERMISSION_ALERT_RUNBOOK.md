# Permission Alert Runbook

## Scope

This runbook handles permission-related alerts generated from Prometheus rules in:

- `monitoring/prometheus/permissions-alert-rules.yml`

Target metrics:

- `http_requests_total` (403 spike)
- `permission_check_duration_ms` (latency)
- `privilege_events_total{event="override_update"}` (override anomalies)

## Setup

1. Ensure backend metrics endpoint is enabled:
   - `METRICS_ENABLED=true`
   - Optional: set `METRICS_API_KEY` and configure Prometheus header `x-metrics-key`
2. Ensure Prometheus scrapes `GET /metrics` from backend.
3. Load rule file `monitoring/prometheus/permissions-alert-rules.yml` in Prometheus config.
4. Route alerts to on-call via Alertmanager.

Example `prometheus.yml` snippet:

```yaml
rule_files:
  - /etc/prometheus/rules/permissions-alert-rules.yml

scrape_configs:
  - job_name: order-backend
    metrics_path: /metrics
    static_configs:
      - targets: ["order-backend:4000"]
    # Optional when METRICS_API_KEY is set:
    # http_headers:
    #   x-metrics-key: "<api-key>"
    # If your Prometheus version does not support custom headers,
    # route scrape traffic through reverse proxy that injects x-metrics-key.
```

## 403 Spike

### Symptoms

- `Permission403SpikeWarning`
- `Permission403SpikeCritical`

### Triage

1. Confirm spike scope:
   - Query: `sum by (path) (rate(http_requests_total{status="403"}[5m]))`
2. Check if related permission denials also increased:
   - Query: `sum(rate(permission_decisions_total{decision="deny"}[5m])) by (resource, action, scope)`
3. Validate recent policy/override changes:
   - Inspect `permission_audits` for last 1 hour.
4. Verify authentication health:
   - Ensure no token/session outage causing false 403.

### Mitigation

1. If caused by bad override batch: rollback/restore intended overrides.
2. If caused by policy migration regression: hotfix affected `role_permissions`.
3. If cache inconsistency suspected: invalidate permission decision cache for impacted users.

## Permission Latency

### Symptoms

- `PermissionCheckLatencyP95Warning`
- `PermissionCheckLatencyP95Critical`

### Triage

1. Check cache hit behavior:
   - Query: `sum(rate(app_cache_requests_total{cache="permission-decision"}[5m])) by (result, source)`
2. Check Redis connectivity/errors in app logs.
3. Check DB plan for permission query:
   - Use `EXPLAIN (ANALYZE, BUFFERS)` against decision query.
4. Confirm indexes exist:
   - `idx_user_permissions_lookup_cover`
   - `idx_role_permissions_lookup_cover`

### Mitigation

1. If Redis unavailable: recover Redis and verify reconnect.
2. If DB scan regressions: run `ANALYZE` and inspect recent migration/index state.
3. If unexpected traffic burst: scale backend replicas and DB resources.

## Override Update Anomaly

### Symptoms

- `OverrideUpdateErrorDetected`
- `OverrideUpdateSpikeWarning`

### Triage

1. Check audit + error logs for actor/target:
   - `permission_audits.action_type = 'update_overrides'`
2. Confirm whether change window was planned (mass role/user update).
3. Investigate DB write failures, constraint failures, or service exceptions.

### Mitigation

1. If unauthorized bulk updates: revoke suspicious overrides and rotate privileged credentials.
2. If accidental batch: reapply approved baseline policy.
3. If persistent failures: block permission update endpoint temporarily and open incident.

## Post-Incident

1. Record incident timeline and impacted resources/users.
2. Attach related access-review report (`npm run security:access-review` output).
3. Add/adjust thresholds if alert was noisy or too late.
