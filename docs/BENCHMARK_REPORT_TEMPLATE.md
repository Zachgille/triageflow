# Benchmark Report Template

## Run Metadata

- Date/time:
- Git commit hash:
- Branch:
- Operator:
- Purpose:

## Machine And Runtime

- Machine/CPU:
- RAM:
- OS:
- Node version:
- pnpm version:
- Docker version:
- PostgreSQL image/version:
- Redis image/version:
- k6 version:

## Application Setup

- API mode:
- API base URL:
- Worker running:
- Web running:
- `NODE_ENV`:
- `CLERK_DEV_BEARER_AUTH`:
- Other relevant env vars:

## Database State

- Seed command:
- Benchmark tenant slug:
- Benchmark tenant id:
- Benchmark assignee user id:
- Tenants:
- Users:
- Memberships:
- Requesters:
- Tickets:
- Comments:
- Audit logs:
- SLA breaches:
- Analytics daily rollups:

## k6 Scenario

- Script:
- VUs:
- Duration:
- Endpoint mix:
- Auth strategy:
- Summary export file:

## Results

| Metric | p50 | p95 | p99 | max | throughput | failure rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Overall | | | | | | |
| Ticket list | | | | | | |
| Status filter | | | | | | |
| Priority filter | | | | | | |
| Assignee filter | | | | | | |
| Cursor page | | | | | | |
| Comments list | | | | | | |
| Mixed read | | | | | | |

## Query Plans

- Ticket list by tenant:
- Ticket list by status:
- Ticket list by priority:
- Ticket list by assignee/status:
- Ticket cursor second page:
- Comments by ticket:
- Analytics daily rollups:

## Notes

- Bottlenecks observed:
- Errors observed:
- Docker/PostgreSQL resource constraints:
- Warmup behavior:
- Deviations from documented methodology:

## Follow-Up Tasks

- 
