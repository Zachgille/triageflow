# Performance

This document defines the benchmark methodology for TriageFlow.

## Goal

Indexed read endpoints should achieve p95 under 150ms under the documented benchmark conditions.

This target applies to controlled local or CI benchmark environments with known hardware, seeded data, warmed application processes, and indexes in place. Results must include p50, p95, and p99 latency.

## Seed Data Shape

The reproducible benchmark dataset must include:

- 50k simulated tickets
- 250k simulated comments
- multiple tenants
- multiple users per tenant
- memberships with varied roles
- assigned and unassigned tickets
- varied priorities
- varied ticket states
- public comments
- internal notes
- audit logs for representative mutations
- SLA policies and tickets near breach conditions

Data distribution should include both common and high-cardinality tenant scenarios so tenant-scoped indexes are exercised realistically.

The local benchmark seed command creates this target shape deterministically:

```powershell
corepack pnpm db:seed:large
```

Default generated data:

- 10 benchmark tenants with slug prefix `bench-`
- 1 large tenant, `bench-large`, with about 25k tickets
- 9 smaller tenants sharing the remaining about 25k tickets
- 500 benchmark users mapped to Clerk provider ids beginning with `clerk_bench_`
- 50k tickets
- 250k comments
- 500k audit logs
- SLA policies for every benchmark tenant and priority
- representative first-response and resolution SLA breaches
- 30 UTC days of analytics daily rollups

The script clears and recreates only tenants whose slug starts with `bench-`; it does not delete the normal `demo` tenant. The seed prints final row counts plus the benchmark tenant slug, tenant id, assignee user id, and local bearer token provider id.

For faster local smoke validation, the seed accepts environment overrides such as `BENCH_TICKET_COUNT`, `BENCH_AUDIT_LOG_COUNT`, `BENCH_COMMENTS_PER_TICKET`, and `BENCH_SEED_CHUNK_SIZE`. Published benchmark claims should use the default 50k/250k target unless the report clearly states the reduced dataset.

## Target Endpoints

Initial read benchmark targets:

- tenant-scoped ticket list using cursor pagination
- ticket list filtered by state using cursor pagination
- ticket list filtered by assignee using cursor pagination
- ticket list ordered by priority using cursor pagination
- ticket detail with paginated public conversation
- ticket detail with paginated internal notes for authorized users
- audit log list for a ticket
- SLA queue candidate lookup
- analytics daily rollup reads
- ticket search

Initial write benchmark targets:

- create ticket
- add public comment
- add internal note
- update ticket assignment
- transition ticket state

Write benchmarks must report latency and error rate, but the p95 under 150ms target is specifically for indexed read endpoints unless a future ADR expands the target.

## k6 Harness

The k6 scripts live in `infra/k6`:

- `ticket-list.js`: indexed ticket list reads, filters, and second-page cursor reads
- `comments.js`: ticket comment cursor reads
- `mixed-workload.js`: read-heavy operational mix covering ticket lists, details, comments, analytics overview, and analytics daily rollups

Root commands:

```powershell
corepack pnpm bench:k6:tickets
corepack pnpm bench:k6:comments
corepack pnpm bench:k6:mixed
```

These commands use `scripts/run-k6.mjs`, which resolves k6 from `K6_BIN`, then from `PATH`, then from `C:\Program Files\k6\k6.exe` on Windows.

If k6 is installed but not visible in the current PowerShell session:

```powershell
$env:K6_BIN="C:\Program Files\k6\k6.exe"
```

The scripts accept:

- `API_BASE_URL`, default `http://localhost:3001`
- `TENANT_SLUG`, default `bench-large`
- `BENCH_AUTH_TOKEN`, default `clerk_bench_owner`
- `BENCH_ASSIGNEE_USER_ID`, required only for assignee-filter ticket-list coverage
- `DURATION`, default `5m`
- `VUS`, default `20`

By default, the runner writes k6 summary JSON to `benchmark-results/local/<benchmark>-<timestamp>.json`. Override the directory with:

```powershell
$env:BENCH_OUTPUT_DIR="benchmark-results/local"
```

Raw summary files are ignored by git. Promote reviewed results into this document or a dedicated benchmark report.

The k6 scripts export p50, p90, p95, p99, max, min, and average trend stats for report capture.

k6 authentication uses the development bearer-token fallback. This must only be used locally:

```powershell
CLERK_DEV_BEARER_AUTH="true"
NODE_ENV="development"
```

The fallback is ignored outside `NODE_ENV=development`. Do not commit real Clerk keys or benchmark secrets.

k6 thresholds:

- indexed read endpoint p95 under 150ms
- `http_req_failed` under 1%

If local hardware, Docker resource limits, debug logging, or dev-mode builds make these numbers unrealistic, record the first run as a baseline rather than claiming the target is met.

## Current Smoke Baseline

Measured locally against the seeded benchmark dataset with 1 VU for 30 seconds:

- ticket list p95: 38.23ms
- status filter p95: 12.44ms
- priority filter p95: 12.63ms
- assignee filter p95: 13.88ms
- cursor second page p95: 31.44ms
- comments list p95: 13.14ms
- mixed read p95: 31.99ms
- failure rate: 0%

This is a smoke baseline only, not a full benchmark claim.

## Current Full Local Baseline

The full local baseline was captured on 2026-05-27 and promoted to:

- `docs/benchmarks/2026-05-27-local-baseline.md`
- `docs/benchmarks/2026-05-27-query-plans.md`

Environment summary:

- Windows 10 Home on Intel Core i5-9600K, 6 cores, about 16 GB RAM
- PostgreSQL 16.14 and Redis 7.4.9 in local Docker containers
- API running locally in development mode with development bearer benchmark auth enabled
- k6 v2.0.0, 20 VUs, 5 minute duration
- Dataset: 10 tenants, 500 users, 50,000 tickets, 250,000 comments, 500,000 audit logs, 5,116 SLA breaches, 300 analytics daily rollups

Result summary:

| Scenario / endpoint | p50 | p95 | p99 | Failure rate |
| --- | ---: | ---: | ---: | ---: |
| ticket list | 30.52ms | 42.00ms | 65.31ms | 0% |
| ticket status filter | 12.18ms | 20.42ms | 40.77ms | 0% |
| ticket priority filter | 12.00ms | 19.59ms | 34.50ms | 0% |
| ticket assignee filter | 12.00ms | 20.00ms | 37.67ms | 0% |
| ticket cursor page | 31.02ms | 43.58ms | 66.93ms | 0% |
| comments list | 11.75ms | 25.90ms | 46.07ms | 0% |
| mixed read workload | 27.93ms | 96.96ms | 183.26ms | 0% |

The p95 under 150ms target was met for all measured k6 thresholds in this local baseline. Query-plan evidence shows indexed plans for filtered ticket lists and comments. Unfiltered ticket queue and unfiltered ticket cursor pages still met the target, but PostgreSQL used sequential scans with top-N sorts; these are documented future optimization candidates rather than immediate changes.

## Ticket Tenant Order Index Follow-Up

The unfiltered tenant ticket queue candidate was evaluated and optimized on 2026-05-27:

- Migration: `20260527123000_ticket_tenant_order_index`
- Index: `tickets_tenant_id_created_at_id_desc_idx` on `tenant_id`, `created_at DESC`, `id DESC`
- Report: `docs/benchmarks/2026-05-27-index-optimization.md`

Before the index, the unfiltered first page and cursor page used sequential scans with top-N sorts and executed in about 13-14ms in direct PostgreSQL plans. After the index, both use `Index Scan using tickets_tenant_id_created_at_id_desc_idx`; direct execution time dropped to about 0.14ms for the first page and 0.08ms for the cursor page.

Focused k6 ticket-list results improved:

| Endpoint tag | Baseline p95 | Post-index p95 |
| --- | ---: | ---: |
| `ticket_list` | 42.00ms | 17.59ms |
| `ticket_list_cursor` | 43.58ms | 19.00ms |

Filtered ticket-list paths remained below target. The index is retained because it is tied to measured query-plan evidence and a documented hot route.

Full local run commands:

```powershell
$env:API_BASE_URL="http://localhost:3001"
$env:TENANT_SLUG="bench-large"
$env:BENCH_AUTH_TOKEN="clerk_bench_owner"
$env:BENCH_ASSIGNEE_USER_ID="dd0b8ce1-9900-5997-b3aa-49708775cb7e"
$env:VUS="20"
$env:DURATION="5m"
corepack pnpm bench:k6:tickets
corepack pnpm bench:k6:comments
corepack pnpm bench:k6:mixed
```

## Methodology

1. Start PostgreSQL and Redis from the documented local environment.
2. Apply all migrations from a clean database.
3. Seed the benchmark dataset.
4. Start the API with benchmark auth explicitly enabled in local development mode.
5. Start worker processes only when the scenario requires background processing.
6. Warm the target endpoints before recording results.
7. Run k6 scenarios with documented virtual users, duration, and request mix.
8. Capture p50, p95, p99, throughput, and error rate.
9. Capture database query plans for slow endpoints.
10. Record hardware, environment, commit SHA, and configuration.

## Required Reporting

Each benchmark report must include:

- commit SHA
- date and environment
- seed data counts
- k6 scenario configuration
- endpoint-level p50, p95, and p99
- aggregate throughput
- error rate
- slowest queries or traces when available
- relevant PostgreSQL indexes
- known bottlenecks

Use `docs/BENCHMARK_REPORT_TEMPLATE.md` for report capture.

## Indexing Expectations

PostgreSQL indexes are required for:

- tenant-scoped ticket lists
- assignee queues
- priority queues
- SLA checks
- audit logs
- search

Indexes should be justified by actual access patterns and query plans. Avoid adding speculative indexes without benchmark or query-plan evidence.

Ticket and comment list benchmarks must preserve the production cursor strategy. Ticket queues order by `created_at DESC, id DESC`; comment timelines order by `created_at ASC, id ASC`. Benchmark scripts should page through result sets with the opaque `nextCursor` returned by the API rather than offset parameters.

## Query Plan Helpers

Copy-paste-ready query plan SQL is maintained in `docs/QUERY_PLANS.md`. If a plan does not use the expected tenant-scoped index, record the query, plan, seed shape, and endpoint before adding indexes.

## Claims

Benchmark reports may claim only what was measured against the seeded dataset, on the reported machine, with the reported commit and configuration. Do not claim "enterprise scale" or generalized production capacity from local k6 runs.

Allowed phrasing:

- "Seeded 50k tickets and 250k comments; benchmarked indexed read endpoints with k6 under documented local conditions."

Disallowed phrasing:

- "enterprise-scale"
- "supports millions of users"
- "production proven"

## Analytics Notes

Analytics daily rollups are intended to keep dashboard-style reads off the hot ticket/comment tables once analytics workers are added. The initial foundation stores one row per tenant per UTC calendar day with a unique tenant/date key. Future benchmarks should measure source-table rollup calculation separately from rollup read latency.
