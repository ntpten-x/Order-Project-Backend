# Access Review Runbook

## Scope

Quarterly review for permission governance:

1. User override footprint (`user_permissions`)
2. Permission change trail (`permission_audits`)
3. Disabled users that still keep direct overrides

## Generate report

```bash
npm run security:access-review
```

Optional:

```bash
npm run security:access-review -- --days=120 --output=logs/access-review-q1.md
```

## Enforce stale policy

Fail the run if stale override items still exist:

```bash
npm run security:access-review -- --days=90 --fail-on-stale --max-stale=0
```

Shorthand:

```bash
npm run security:access-review:enforce
```

`--max-stale` can be relaxed temporarily for controlled cleanup windows.

## Quarterly automation

GitHub Actions workflow: `.github/workflows/access-review-quarterly.yml`

- Schedule: quarterly (Jan/Apr/Jul/Oct, 03:00 UTC)
- Manual run: `workflow_dispatch` with optional `days` and `max_stale`
- Output: uploads `logs/permission-access-review-*.md` as workflow artifact

## Required actions

1. Revoke overrides for disabled users immediately.
2. Revalidate any override that grants `delete` or `scope=all`.
3. Close stale overrides each review cycle (or document approved exception with expiry).
4. Archive generated report in compliance evidence folder.

## Offboarding automation

When a user is disabled (`is_use=false`), backend now automatically removes user-level overrides and writes a `permission_audits` record with action `offboarding_revoke`.
