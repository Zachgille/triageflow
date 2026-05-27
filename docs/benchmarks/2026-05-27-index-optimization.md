# 2026-05-27 Ticket Tenant Order Index Optimization

## Scope

This optimization is limited to the measured unfiltered tenant ticket queue and cursor page:

```sql
WHERE tenant_id = ?
ORDER BY created_at DESC, id DESC
LIMIT ?
```

and:

```sql
WHERE tenant_id = ?
  AND (created_at, id) is older than the opaque cursor
ORDER BY created_at DESC, id DESC
LIMIT ?
```

Filtered ticket-list paths were not changed because the baseline query plans already used tenant-scoped indexes for status, priority, and assignee queues.

## Change

Migration:

- `20260527123000_ticket_tenant_order_index`

Index:

```sql
CREATE INDEX "tickets_tenant_id_created_at_id_desc_idx"
  ON "tickets" ("tenant_id", "created_at" DESC, "id" DESC);
```

Prisma schema also declares the index on `Ticket`:

```prisma
@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)], map: "tickets_tenant_id_created_at_id_desc_idx")
```

## Query Plan Comparison

### Unfiltered Tenant Ticket List

Before:

```text
Seq Scan on tickets ... rows=25000
Rows Removed by Filter: 25003
Sort Method: top-N heapsort
Execution Time: 13.591 ms
```

After:

```text
Index Scan using tickets_tenant_id_created_at_id_desc_idx on tickets
Index Cond: tenant_id = bench-large
Execution Time: 0.142 ms
```

Result:

- Sequential scan eliminated.
- Top-N sort eliminated.
- Execution time improved from about 13.6ms to about 0.14ms.

### Unfiltered Ticket Cursor Page

Before:

```text
Seq Scan on tickets ... rows=24949
Rows Removed by Filter: 25054
Sort Method: top-N heapsort
Execution Time: 14.208 ms
```

After:

```text
Index Scan using tickets_tenant_id_created_at_id_desc_idx on tickets
Index Cond: tenant_id = bench-large
Rows Removed by Filter: 51
Execution Time: 0.084 ms
```

Result:

- Sequential scan eliminated.
- Top-N sort eliminated.
- Cursor filter examines only a small number of rows past the cursor in this sample.
- Execution time improved from about 14.2ms to about 0.08ms.

## k6 Comparison

Focused ticket benchmark configuration:

- `VUS=20`
- `DURATION=5m`
- `API_BASE_URL=http://localhost:3001`
- `TENANT_SLUG=bench-large`
- `BENCH_AUTH_TOKEN=clerk_bench_owner`
- `BENCH_ASSIGNEE_USER_ID=dd0b8ce1-9900-5997-b3aa-49708775cb7e`

Baseline summary file:

- `benchmark-results/local/tickets-2026-05-27T12-04-37-646Z.json`

Post-index summary file:

- `benchmark-results/local/tickets-2026-05-27T22-44-08-170Z.json`

| Endpoint tag | Baseline p50 | Baseline p95 | Baseline p99 | Post-index p50 | Post-index p95 | Post-index p99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `ticket_list` | 30.52ms | 42.00ms | 65.31ms | 10.80ms | 17.59ms | 37.40ms |
| `ticket_list_cursor` | 31.02ms | 43.58ms | 66.93ms | 11.00ms | 19.00ms | 44.58ms |
| `ticket_list_status` | 12.18ms | 20.42ms | 40.77ms | 11.29ms | 19.56ms | 47.66ms |
| `ticket_list_priority` | 12.00ms | 19.59ms | 34.50ms | 11.41ms | 19.22ms | 49.59ms |
| `ticket_list_assignee` | 12.00ms | 20.00ms | 37.67ms | 11.68ms | 20.10ms | 46.80ms |

Post-index focused ticket run:

- HTTP requests: 28,210
- Throughput: 93.69 requests/second
- Request failure rate: 0%
- All ticket-list thresholds passed.

Optional mixed workload regression check:

- Summary file: `benchmark-results/local/mixed-2026-05-27T22-49-20-469Z.json`
- p50: 10.24ms
- p95: 74.95ms
- p99: 187.35ms
- Request failure rate: 0%

## Tradeoff

Benefits:

- Aligns the unfiltered tenant ticket queue with its production cursor ordering.
- Removes sequential scans and top-N sorts from the large-tenant first page and second page.
- Improves focused ticket-list p95 from 42.00ms to 17.59ms.
- Improves focused cursor-page p95 from 43.58ms to 19.00ms.
- Gives stronger evidence for the p95 benchmark claim as tenant ticket counts grow.

Costs:

- Adds disk usage for one additional ticket index.
- Adds write amplification for ticket inserts.
- Adds maintenance overhead when `tenant_id`, `created_at`, or `id` are indexed, though `created_at` and `id` are immutable after insert in normal operation.

Decision:

Keep the index. The measured read-path improvement is large, the index directly matches a documented hot query shape, and the write overhead is acceptable for this support-desk workload.

## Follow-Up

- Watch ticket create throughput when write benchmarks are added.
- Revisit p99 outliers in mixed workloads only if they persist in CI or production-like runs.
- Do not add additional ticket indexes until a new query plan or benchmark shows a specific need.

