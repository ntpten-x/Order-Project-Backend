# Query Plan Guide

Use this guide to capture Postgres execution plans for the most important queries.

## How to Run
1. Connect to the database with `psql`.
2. Set the placeholders used in `scripts/query-plan.sql`:

```sql
\\set branch_id '00000000-0000-0000-0000-000000000000'
\\set order_id '00000000-0000-0000-0000-000000000000'
```

3. Execute the file:

```sql
\\i scripts/query-plan.sql
```

## Notes
- Run `EXPLAIN (ANALYZE, BUFFERS)` only on staging or during low traffic.
- If you need a plan without executing the query, use `EXPLAIN (VERBOSE, BUFFERS)`.
- Capture the output and compare before/after index changes.
