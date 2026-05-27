# 2026-05-27 Local Baseline

## Summary

This report captures a local baseline against the deterministic benchmark dataset. It supports the limited claim:

> Seeded 50k tickets and 250k comments; benchmarked indexed read endpoints with k6 under documented local conditions.

It does not support claims about enterprise scale, production readiness, millions of users, or cloud reliability.

## Environment

- Date/time: 2026-05-27, approximately 12:04-12:20 local time
- Git commit: unavailable; repository has no commit yet
- OS: Microsoft Windows 10 Home 10.0.19045, 64-bit
- CPU: Intel Core i5-9600K, 6 cores / 6 logical processors
- Memory: about 16 GB visible RAM
- Node: v24.16.0
- pnpm: 9.15.4
- Docker: 29.4.3
- PostgreSQL: 16.14, Docker container `triageflow-postgres`
- Redis: 7.4.9, Docker container `triageflow-redis`
- k6: v2.0.0 at `C:\Program Files\k6\k6.exe`
- API base URL: `http://localhost:3001`
- API mode: `NODE_ENV=development`
- Benchmark auth: development bearer token enabled in the running API process
- Worker: not part of the measured request path for this baseline

## Dataset

`corepack pnpm db:bench:counts` reported:

| Table / entity | Count |
| --- | ---: |
| Benchmark tenants | 10 |
| Benchmark users | 500 |
| Memberships | 500 |
| Requesters | 1,000 |
| Tickets | 50,000 |
| Comments | 250,000 |
| Audit logs | 500,000 |
| SLA breaches | 5,116 |
| Analytics daily rollups | 300 |

Benchmark tenant:

- Slug: `bench-large`
- Tenant id: `2f3c4423-e6f2-58f5-8afa-deceb2850ec5`
- Assignee user id used by k6: `dd0b8ce1-9900-5997-b3aa-49708775cb7e`
- Development benchmark bearer token/provider id: `clerk_bench_owner`

## Commands

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

The final p99-capable summary files were:

- `benchmark-results/local/tickets-2026-05-27T12-04-37-646Z.json`
- `benchmark-results/local/comments-2026-05-27T12-09-49-166Z.json`
- `benchmark-results/local/mixed-2026-05-27T12-14-58-006Z.json`

Raw local JSON summaries are ignored by git; this report is the promoted evidence.

## Results

### Ticket List

20 VUs for 5 minutes, 27,095 HTTP requests, 90.06 requests/second, 0% request failures.

| Endpoint tag | p50 | p95 | p99 | Max |
| --- | ---: | ---: | ---: | ---: |
| `ticket_list` | 30.52ms | 42.00ms | 65.31ms | 252.40ms |
| `ticket_list_status` | 12.18ms | 20.42ms | 40.77ms | 117.01ms |
| `ticket_list_priority` | 12.00ms | 19.59ms | 34.50ms | 91.39ms |
| `ticket_list_assignee` | 12.00ms | 20.00ms | 37.67ms | 68.00ms |
| `ticket_list_cursor` | 31.02ms | 43.58ms | 66.93ms | 152.44ms |
| overall HTTP | 15.00ms | 37.68ms | 55.51ms | 252.40ms |

### Comments

20 VUs for 5 minutes, 11,476 HTTP requests, 38.12 requests/second, 0% request failures.

| Endpoint tag | p50 | p95 | p99 | Max |
| --- | ---: | ---: | ---: | ---: |
| `comments_list` | 11.75ms | 25.90ms | 46.07ms | 120.81ms |
| `comments_cursor` | 0.00ms | 0.00ms | 0.00ms | 0.00ms |
| overall HTTP | 25.03ms | 42.81ms | 62.76ms | 248.88ms |

`comments_cursor` was not exercised by this dataset/script path because the selected benchmark ticket did not return a second comment page during the run.

### Mixed Read Workload

20 VUs for 5 minutes, 7,500 HTTP requests, 24.92 requests/second, 0% request failures.

| Metric tag | p50 | p95 | p99 | Max |
| --- | ---: | ---: | ---: | ---: |
| `kind:read` | 27.93ms | 96.96ms | 183.26ms | 344.40ms |
| overall HTTP | 27.93ms | 96.96ms | 183.26ms | 344.40ms |

Endpoint coverage included ticket list, ticket detail, comments list, analytics overview, and analytics daily rollups.

## Target Evaluation

The documented p95 target for indexed read endpoints is under 150ms. This baseline met that target for every measured k6 threshold:

- Ticket list and filtered ticket list p95 values were all below 44ms.
- Comments list p95 was below 26ms.
- Mixed read p95 was below 97ms.
- Request failure rate was 0% for all three runs.

## Observations

- Filtered ticket-list paths used tenant-scoped indexes and were comfortably below target.
- Unfiltered ticket list and unfiltered cursor page met latency targets, but query plans showed sequential scans over the 50k-ticket table with a top-N sort for the large tenant.
- Analytics daily rollups are tiny in this dataset and read quickly even with a sequential scan.
- The mixed workload p99 exceeded 150ms, but the current target is p95 for indexed read endpoints. p99 should be watched in future larger or CI benchmarks.

## Optimization Decision

No optimization is needed yet because all p95 targets passed comfortably under the documented local conditions.

Future optimization candidates, if larger datasets or CI/cloud runs show regression:

- Add an index that better matches unfiltered ticket queue ordering by `tenant_id`, `created_at DESC`, and `id DESC`.
- Add an index that better matches ticket cursor pagination with the `id` tie-breaker.
- Investigate mixed-workload p99 outliers if they persist outside local dev mode.
- Add a benchmark ticket with more than 50 comments so `comments_cursor` is exercised in full runs.

