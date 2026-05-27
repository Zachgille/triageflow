# 2026-05-27 Query Plans

Query plans were captured against the local benchmark dataset using PostgreSQL 16.14 in Docker:

```powershell
docker exec -i triageflow-postgres psql -U triageflow -d triageflow
```

Each query used `EXPLAIN (ANALYZE, BUFFERS)`.

## Ticket List By Tenant

SQL shape:

```sql
SELECT id, subject, status, priority, assignee_user_id, requester_id, created_at
FROM tickets
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Relevant plan lines:

```text
Seq Scan on tickets ... rows=25000
Rows Removed by Filter: 25003
Sort Method: top-N heapsort
Execution Time: 13.591 ms
```

Plan assessment: The query met the k6 p95 target, but it did not use a tenant/order index. This is the clearest future index candidate if the unfiltered ticket queue regresses at larger row counts.

## Ticket List By Tenant And Status

SQL shape:

```sql
SELECT id, subject, status, priority, assignee_user_id, requester_id, created_at
FROM tickets
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
  AND status = 'OPEN'
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Relevant plan lines:

```text
Index Scan Backward using tickets_tenant_id_status_created_at_idx
Index Cond: tenant_id + status
Incremental Sort, Presorted Key: created_at
Execution Time: 0.113 ms
```

Plan assessment: Supports the benchmark claim. The tenant/status index is used and the query is well below the p95 target.

## Ticket List By Tenant And Priority

SQL shape:

```sql
SELECT id, subject, status, priority, assignee_user_id, requester_id, created_at
FROM tickets
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
  AND priority = 'HIGH'
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Relevant plan lines:

```text
Index Scan Backward using tickets_tenant_id_priority_created_at_idx
Index Cond: tenant_id + priority
Incremental Sort, Presorted Key: created_at
Execution Time: 0.124 ms
```

Plan assessment: Supports the benchmark claim. The tenant/priority index is used and the query is well below target.

## Ticket List By Tenant, Assignee, And Status

SQL shape:

```sql
SELECT id, subject, status, priority, assignee_user_id, requester_id, created_at
FROM tickets
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
  AND assignee_user_id = 'dd0b8ce1-9900-5997-b3aa-49708775cb7e'::uuid
  AND status = 'OPEN'
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Relevant plan lines:

```text
Bitmap Index Scan on tickets_tenant_id_assignee_user_id_status_created_at_idx
Bitmap Heap Scan on tickets ... rows=68
Sort Method: quicksort
Execution Time: 0.240 ms
```

Plan assessment: Supports the benchmark claim. The tenant/assignee/status index is used and the small sort is acceptable for the measured dataset.

## Ticket Cursor Second Page

SQL shape:

```sql
SELECT id, subject, status, priority, assignee_user_id, requester_id, created_at
FROM tickets
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
  AND (
    created_at < '2026-02-21 23:27:00'::timestamp
    OR (created_at = '2026-02-21 23:27:00'::timestamp AND id < 'ebeea394-30f4-5d73-83c1-5475559a5b00'::uuid)
  )
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Relevant plan lines:

```text
Seq Scan on tickets ... rows=24949
Rows Removed by Filter: 25054
Sort Method: top-N heapsort
Execution Time: 14.208 ms
```

Plan assessment: The query met the measured p95 target, but the plan is not ideal. A future composite index including `id` after `created_at` should be considered if cursor pages become slower under larger datasets.

## Comments By Tenant And Ticket

SQL shape:

```sql
SELECT id, ticket_id, visibility, author_user_id, author_requester_id, created_at
FROM ticket_comments
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
  AND ticket_id = '00014612-06ea-51ed-84fc-92037ada4473'::uuid
ORDER BY created_at ASC, id ASC
LIMIT 50;
```

Relevant plan lines:

```text
Index Scan using ticket_comments_tenant_id_ticket_id_created_at_idx
Index Cond: tenant_id + ticket_id
Incremental Sort, Presorted Key: created_at
Execution Time: 0.171 ms
```

Plan assessment: Supports the benchmark claim. The tenant/ticket/comment timeline index is used.

## Analytics Daily Rollups By Tenant And Date

SQL shape:

```sql
SELECT date, opened_count, resolved_count, closed_count, public_comment_count, internal_note_count
FROM analytics_daily_rollups
WHERE tenant_id = '2f3c4423-e6f2-58f5-8afa-deceb2850ec5'::uuid
  AND date >= '2026-01-01'::date
  AND date <= '2026-01-30'::date
ORDER BY date ASC;
```

Relevant plan lines:

```text
Seq Scan on analytics_daily_rollups ... rows=30
Rows Removed by Filter: 270
Execution Time: 0.088 ms
```

Plan assessment: The table is tiny in the current dataset, so PostgreSQL chose a sequential scan despite the tenant/date index. This is acceptable for the measured baseline; no optimization is justified from this evidence.

