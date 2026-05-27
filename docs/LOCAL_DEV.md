# Local Development

This guide uses Windows PowerShell from the repository root.

## Prerequisites

- Node.js with Corepack available
- Docker Desktop with Docker Compose
- Git

## Setup Flow

Install dependencies:

```powershell
corepack pnpm install
```

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Start PostgreSQL and Redis:

```powershell
corepack pnpm infra:up
```

Apply Prisma migrations:

```powershell
corepack pnpm db:migrate
```

Generate Prisma Client:

```powershell
corepack pnpm db:generate
```

Seed demo RBAC data:

```powershell
corepack pnpm db:seed
```

Run validation:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

## Useful Commands

Validate the Prisma schema without applying migrations:

```powershell
corepack pnpm db:validate
```

Reset the local database and rerun migrations and seed data:

```powershell
corepack pnpm db:reset
```

Stop local infrastructure:

```powershell
corepack pnpm infra:down
```

Follow Docker logs:

```powershell
corepack pnpm infra:logs
```

Run a one-off SLA breach check after building the worker:

```powershell
corepack pnpm build
corepack pnpm worker:sla:check
```

Optional arguments are forwarded after `--` from the worker package command:

```powershell
corepack pnpm --filter @triageflow/worker sla:check -- --tenantId=<tenant-uuid> --limit=50 --now=2026-05-26T12:00:00.000Z
```

The long-running worker process registers the BullMQ `sla` queue and `check-breaches` job processor:

```powershell
corepack pnpm --filter @triageflow/worker dev
```

When the worker starts, it upserts the repeatable SLA breach check schedule. By default it runs every 60 seconds. Override the interval in `.env`:

```powershell
SLA_CHECK_INTERVAL_SECONDS="60"
```

Inspect basic queue status:

```powershell
corepack pnpm worker:queues:status
```

Run a one-off analytics daily rollup job after building the worker. The job is bounded to one tenant and one UTC date:

```powershell
corepack pnpm build
corepack pnpm worker:analytics:rollup -- --tenant <tenant-uuid> --date 2026-05-26
```

If `--date` is omitted, the worker defaults to yesterday UTC. The command enqueues BullMQ queue `analytics`, job `rollup-daily`; keep the worker process running to process queued jobs:

```powershell
corepack pnpm --filter @triageflow/worker dev
```

Analytics repeatable scheduling is disabled by default for local development. To enable the conservative scheduler, set these values in `.env` and restart the worker:

```powershell
ANALYTICS_ROLLUP_SCHEDULE_ENABLED="true"
ANALYTICS_ROLLUP_INTERVAL_SECONDS="3600"
ANALYTICS_ROLLUP_TENANT_BATCH_SIZE="100"
```

When enabled, the worker upserts BullMQ scheduler `analytics:schedule-daily-rollups:every-interval` for queue `analytics`, job `schedule-daily-rollups`. Each scheduler run targets yesterday UTC, loads at most `ANALYTICS_ROLLUP_TENANT_BATCH_SIZE` tenants, and enqueues one deterministic `rollup-daily` job per tenant/date. It does not calculate rollups directly and does not scan historical dates.

Run the scheduler job once manually for local verification:

```powershell
corepack pnpm build
corepack pnpm worker:analytics:schedule-once -- --date 2026-05-26 --limit 25
```

## Local Benchmarks

The large benchmark seed is opt-in and recreates only tenants whose slugs start with `bench-`. It does not delete the normal `demo` tenant.

Preview the deterministic seed plan:

```powershell
corepack pnpm db:seed:large:dry-run
```

Create the benchmark dataset:

```powershell
corepack pnpm db:seed:large
```

The default target dataset is:

- 10 tenants
- 500 users
- 50,000 tickets
- 250,000 comments
- 500,000 audit logs
- SLA policies, SLA breaches, and 30 days of analytics rollups

The seed prints the benchmark tenant slug, tenant id, assignee user id, and bearer token provider id. By default:

```powershell
TENANT_SLUG="bench-large"
BENCH_AUTH_TOKEN="clerk_bench_owner"
```

k6 benchmark auth uses the existing development bearer-token fallback. Start the API for benchmark runs with:

```powershell
CLERK_DEV_BEARER_AUTH="true"
NODE_ENV="development"
corepack pnpm --filter @triageflow/api dev
```

Do not enable `CLERK_DEV_BEARER_AUTH` in production. The API ignores this fallback outside `NODE_ENV=development`.

Run k6 scripts from another PowerShell window after the API is running:

```powershell
corepack pnpm bench:k6:tickets
corepack pnpm bench:k6:comments
corepack pnpm bench:k6:mixed
```

If k6 is installed but not available on `PATH`, set:

```powershell
$env:K6_BIN="C:\Program Files\k6\k6.exe"
```

Each benchmark command writes a k6 summary JSON file to `benchmark-results/local` by default. Raw summary files are ignored by git.

Print current benchmark row counts:

```powershell
corepack pnpm db:bench:counts
```

Override benchmark parameters with environment variables:

```powershell
$env:API_BASE_URL="http://localhost:3001"
$env:TENANT_SLUG="bench-large"
$env:BENCH_AUTH_TOKEN="clerk_bench_owner"
$env:BENCH_ASSIGNEE_USER_ID="<printed-user-uuid>"
$env:VUS="1"
$env:DURATION="30s"
corepack pnpm bench:k6:tickets
```

If `k6` is not recognized, install k6 locally and restart PowerShell. The project does not install k6 as an npm package.

## Environment Variables

For the full environment setup guide, including Clerk key handling, see [ENV_SETUP.md](ENV_SETUP.md).

`.env.example` contains the required local placeholders:

- `DATABASE_URL`
- `REDIS_URL`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `CLERK_DEV_BEARER_AUTH`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `SLA_CHECK_INTERVAL_SECONDS`
- `ANALYTICS_ROLLUP_SCHEDULE_ENABLED`
- `ANALYTICS_ROLLUP_INTERVAL_SECONDS`
- `ANALYTICS_ROLLUP_TENANT_BATCH_SIZE`
- `APP_BASE_URL`
- `NODE_ENV`
- `PORT`

For the default Docker Compose services, `DATABASE_URL` should be:

```powershell
postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public
```

For real Clerk authentication, set:

```powershell
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_AUTHORIZED_PARTIES="http://localhost:3000"
```

`CLERK_DEV_BEARER_AUTH` defaults to `false`. Set it to `true` only for explicit local development fallback testing with seeded provider ids. The API ignores this fallback outside `NODE_ENV=development`.

Run the local environment doctor after editing `.env`:

```powershell
corepack pnpm env:doctor
```

After starting the API and web dev servers, run the local reachability smoke helper:

```powershell
corepack pnpm smoke:local
```

## Local Onboarding Flow

After the API and web app are running with Clerk keys configured, open:

```powershell
http://localhost:3000/onboarding
```

Use the page to sign in, create the internal application profile for the Clerk user, and create a first workspace. Workspace creation creates only that tenant, tenant-local owner/admin roles, role permissions, and an owner membership for the current user.

Authenticated Clerk users without an internal application user receive an onboarding-required response from `GET /api/me`; they do not receive tenant access until `POST /api/onboarding/profile` creates the internal user and `POST /api/onboarding/tenant` creates or assigns a tenant membership.

## Troubleshooting

### Docker Is Not Installed

If `corepack pnpm infra:up` fails because `docker-compose` is not recognized, install Docker Desktop and restart PowerShell. This repository currently uses `docker-compose.exe`, which is the command exposed by the verified local Docker Desktop installation.

### Port 5432 Is Already In Use

If PostgreSQL cannot start because port `5432` is already allocated, stop the other PostgreSQL service or change the host port in `infra/docker-compose.yml`.

After changing the host port, update the port in `.env` `DATABASE_URL` to match.

### DATABASE_URL Is Missing

If Prisma reports that `DATABASE_URL` is missing, create `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Run DB commands from the repository root so the root `.env` is loaded by the root scripts.

### Migration Cannot Connect

If `corepack pnpm db:migrate` cannot connect:

1. Confirm Docker services are running:

```powershell
docker-compose -f infra/docker-compose.yml ps
```

2. Confirm the database URL points to the expected host and port:

```powershell
Get-Content .env
```

3. Check service logs:

```powershell
corepack pnpm infra:logs
```

4. Retry the migration:

```powershell
corepack pnpm db:migrate
```
