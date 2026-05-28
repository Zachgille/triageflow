# Implementation State

Last updated: 2026-05-27

## Current Phase

Portfolio/repository polish for reviewer handoff.

## Completed

- Created the project technical contract.
- Documented architecture, project rules, security model, test plan, and performance benchmark expectations.
- Recorded initial architectural decisions for tenancy, modular monolith architecture, Redis workers, tenant-scoped repositories, PostgreSQL indexing, and Clerk authentication with application RBAC.
- Created pnpm workspace configuration.
- Added root TypeScript, ESLint, and Prettier configuration.
- Added `apps/web` as a minimal Next.js, TypeScript, Tailwind CSS, and shadcn/ui-ready app.
- Added `apps/api` as a minimal NestJS + Fastify API with a placeholder `GET /health` endpoint.
- Added `apps/worker` as a minimal NestJS worker process shell with no queues registered yet.
- Added `packages/db` with Prisma package wiring.
- Added `packages/shared` for shared TypeScript types.
- Added `packages/config` for future shared configuration helpers.
- Added Docker Compose infrastructure for PostgreSQL and Redis.
- Added GitHub Actions CI workflow for install, lint, typecheck, and build.
- Installed workspace dependencies with pnpm via Corepack.
- Generated `pnpm-lock.yaml`.
- Added `.env.example` with placeholder values for `DATABASE_URL`, `REDIS_URL`, `CLERK_SECRET_KEY`, `APP_BASE_URL`, and `NODE_ENV`.
- Hardened `.gitignore` for dependency directories, env files, nested build outputs, Prisma generated output, local logs, and TypeScript build info.
- Updated CI to use frozen lockfile installation now that `pnpm-lock.yaml` exists.
- Fixed scaffold tooling issues in root scripts and ESLint configuration.
- Defined the initial Prisma schema for application users, tenants, memberships, roles, permissions, and role permissions.
- Added tenant-scoped RBAC constraints: memberships, roles, and role permissions all include `tenant_id` and enforce tenant-specific role assignment.
- Added the initial Prisma migration at `packages/db/prisma/migrations/20260526120000_initial_rbac_foundation/migration.sql`.
- Added Prisma seed data for one demo tenant with owner, admin, agent, and viewer users.
- Added local database lifecycle scripts for Docker infrastructure, Prisma validation, migration, client generation, seeding, and reset.
- Added `docs/LOCAL_DEV.md` with the Windows PowerShell setup flow and troubleshooting notes.
- Updated README and AGENTS with the local DB verification commands.
- Added `dotenv-cli` so root DB scripts load the root `.env` file before invoking package-local Prisma commands.
- Added Zod-based runtime configuration validation for the API through `packages/config`.
- Added API database wiring with a NestJS `DatabaseModule` and `PrismaService` using the Prisma client exported by `packages/db`.
- Added API Redis wiring with a NestJS `RedisModule` and `RedisService` for connectivity checks.
- Replaced the placeholder health endpoint with `GET /health/live` and `GET /health/ready`.
- Readiness now checks validated config, PostgreSQL connectivity, and Redis connectivity with structured failure responses that do not include secret values.
- Added API authentication infrastructure with an `AuthIdentityProvider` abstraction and `ClerkAuthGuard`.
- Added tenant context infrastructure that resolves `:tenantSlug`, maps Clerk provider user ids to internal users, loads tenant membership, and derives membership permissions.
- Added `RequestContext` containing `requestId`, `userId`, `tenantId`, `membershipId`, and `permissions`.
- Added `@RequirePermission(...)` and `PermissionGuard` for backend-enforced RBAC checks.
- Added a temporary debug-only endpoint at `GET /api/tenants/:tenantSlug/_debug/context` requiring `tenant.manage`.
- Added Vitest-based API guard tests covering unauthenticated rejection, no-membership rejection, allowed tenant access, cross-tenant role differences, and missing permission rejection.
- Added the initial tenant-owned ticket domain schema with `Requester`, `Ticket`, `TicketStatus`, and `TicketPriority`.
- Added tenant-scoped ticket indexes for status lists, assignee queues, and priority queues.
- Added the ticket domain migration at `packages/db/prisma/migrations/20260526133000_initial_ticket_domain/migration.sql`.
- Extended demo seed data with 3 requesters and 3 tickets.
- Added `TicketsModule` without controllers or routes.
- Added `TicketRepository` with tenant-scoped `findMany`, `findById`, `create`, `updateFields`, `transitionStatus`, and `assign` methods.
- Added `TicketService` with `listTickets`, `getTicket`, `createTicket`, `updateTicket`, `transitionTicket`, and `assignTicket`.
- Added typed ticket domain errors for not found, invalid transitions, tenant constraint failures, and missing request context.
- Added service-level status transition enforcement for the documented ticket workflow.
- Added repository tests for tenant scoping, same-tenant requester validation, same-tenant assignee validation, not exposing unscoped helpers, and required `RequestContext`.
- Added service tests for all valid transitions, forbidden transition examples, and tenant-scoped not-found behavior.
- Added the tenant-owned `AuditLog` Prisma model with nullable actor, before/after JSON, metadata JSON, request id, optional IP address, and tenant-scoped indexes.
- Added the audit log migration at `packages/db/prisma/migrations/20260526143000_audit_log_foundation/migration.sql`.
- Added `AuditModule` and `AuditService` with `record`, `listForEntity`, and `listForTenant`.
- Added audit action constants for `ticket.created`, `ticket.updated`, `ticket.status_changed`, `ticket.assigned`, and `ticket.priority_changed`.
- Made audit writes usable with a provided Prisma transaction client for future atomic mutation plus audit log workflows.
- Added audit service tests for required audit fields, tenant-scoped entity reads, cross-tenant isolation for shared entity ids, tenant filters, and transaction client usage.
- Added protected ticket API routes:
  - `GET /api/tenants/:tenantSlug/tickets`
  - `POST /api/tenants/:tenantSlug/tickets`
  - `GET /api/tenants/:tenantSlug/tickets/:ticketId`
  - `PATCH /api/tenants/:tenantSlug/tickets/:ticketId`
  - `POST /api/tenants/:tenantSlug/tickets/:ticketId/transition`
  - `POST /api/tenants/:tenantSlug/tickets/:ticketId/assign`
- Added ticket API permission mapping: `ticket:read`, `ticket:create`, `ticket:update`, and `ticket:assign`.
- Added explicit ticket API validation for UUID params, requester/assignee UUID fields, ticket status, priority, subject length, description length, filters, and list limit.
- Added `TicketApiService` to coordinate ticket mutations and audit writes inside Prisma transactions without controllers calling Prisma directly.
- Added transactional audit logging for ticket create, update, priority change, status transition, and assignment mutations.
- Extended demo seed permissions with the `ticket:*` endpoint permissions while retaining earlier placeholder `tickets.*` permission keys.
- Added ticket controller integration tests covering unauthenticated rejection, viewer read-only behavior, agent update access, cross-tenant read/update denial, invalid transition conflict behavior, create/transition/assign audit logs, tenant-scoped listing, and tenant-specific role differences.
- Added tenant-owned `TicketComment` Prisma model with `PUBLIC` and `INTERNAL` visibility, tenant-scoped ticket relation, tenant-scoped user/requester author relations, and indexes for ticket timelines and author lookups.
- Added the ticket comments migration at `packages/db/prisma/migrations/20260526150000_ticket_comments/migration.sql`, including a database check constraint requiring exactly one author.
- Added `CommentsModule`, `CommentsController`, `CommentRepository`, and `CommentService`.
- Added protected comment routes:
  - `GET /api/tenants/:tenantSlug/tickets/:ticketId/comments`
  - `POST /api/tenants/:tenantSlug/tickets/:ticketId/comments`
- Added comment permissions: `comment:create_public`, `comment:create_internal`, and `comment:read_internal`.
- Internal note reads use `comment:read_internal`; `ticket:read` alone returns only public comments.
- Public comment creation requires `comment:create_public`; internal note creation requires `comment:create_internal`.
- Added transactional audit logging for `comment.public_created` and `comment.internal_created`.
- Extended demo seed permissions for owner/admin/agent/viewer comment access.
- Added comment controller integration tests covering public creation, internal note create permission, internal note visibility filtering, cross-tenant 404 behavior, tenant-scoped comment lists, cross-tenant create denial, audit logging, oversized body validation, and empty body validation.
- Added the first support desk frontend workflow in `apps/web`.
- Added frontend pages:
  - `/[tenantSlug]/tickets`
  - `/[tenantSlug]/tickets/[ticketId]`
  - `/[tenantSlug]/tickets/new`
- Added a tenant dashboard shell with Clerk sign-in, sign-up, user profile, and sign-out controls.
- Added a typed frontend API client for ticket and comment endpoints using `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:3001`.
- Added a Next.js `/api/:path*` rewrite so browser calls stay same-origin and proxy to the API target from `NEXT_PUBLIC_API_BASE_URL`.
- Added ticket list UI with status and priority filters, loading, empty, and error states.
- Added ticket detail UI with ticket metadata, status transition control, assignment control, public comments, internal notes when returned by the backend, and comment/internal note creation controls.
- Added create ticket form using backend ticket creation only.
- Added local UI components for buttons, fields, badges, and workflow states using the existing Tailwind/shadcn-ready styling conventions.
- Added cosmetic permission hiding hooks while preserving backend authorization as authoritative.
- Added `NEXT_PUBLIC_API_BASE_URL` to `.env.example`; no frontend secrets were added.
- Installed `@clerk/nextjs` in `apps/web` and wrapped the Next.js app in `ClerkProvider`.
- Installed `@clerk/backend` in `apps/api`.
- Replaced the API Clerk placeholder with Clerk JWT verification using `verifyToken`.
- Frontend API calls now send Clerk session tokens from `useAuth().getToken()` as bearer tokens.
- Removed the frontend development identity selector and seeded-provider-id token behavior from the UI.
- Added explicit `CLERK_DEV_BEARER_AUTH` for local development fallback; it defaults to `false` and is ignored outside `NODE_ENV=development`.
- Preserved application-owned authorization: Clerk authenticates only, and tenant membership/permissions still come from the database.
- Kept internal user bootstrap behavior as reject-only. Authenticated Clerk users without an internal `User` row receive `APPLICATION_USER_NOT_FOUND`; no automatic user creation was added.
- Made the temporary debug context endpoint unavailable in production.
- Added Clerk auth provider tests covering missing token rejection, invalid token rejection, valid token mapping, and development fallback behavior.
- Added debug endpoint test coverage for production unavailability.
- Added API test environment setup for required runtime config values.
- Added Clerk environment variables to `.env.example`.
- Updated `apps/web` from Next.js 15 to Next.js 16.2.6 and updated the root `@next/eslint-plugin-next` package to 16.2.6.
- Cleared stale Next/TypeScript incremental output after the upgrade so `next typegen` and `tsc --noEmit` use the new Next 16 generated type layout.
- Added authenticated onboarding/profile API routes:
  - `GET /api/me`
  - `POST /api/onboarding/profile`
  - `POST /api/onboarding/tenant`
- Extended the API auth identity to carry non-secret Clerk profile claims when present.
- Added an onboarding service that returns structured onboarding-required responses for valid Clerk users without an internal application user.
- Added idempotent profile bootstrap that links the current Clerk provider user id to an internal `User` row.
- Added first-workspace creation that runs in a transaction, creates a new tenant, creates tenant-local owner/admin roles, links role permissions, and creates an owner membership for only the current user.
- Added duplicate tenant slug handling with `TENANT_SLUG_TAKEN`.
- Added onboarding API integration tests covering onboarding-required profile reads, idempotent profile creation, transactional tenant creation, no access grant to existing tenants, multi-tenant permission serialization, and duplicate slug rejection.
- Added a minimal `/onboarding` frontend flow with Clerk sign-in/sign-up, complete-profile action, create-workspace form, and workspace selector using `GET /api/me`.
- Updated the home page to direct users to the authenticated onboarding flow instead of the seeded demo tenant.
- Added a shared frontend workspace shell for tenant routes using `GET /api/me` as the source of current user, memberships, active tenant, active role, and active permissions.
- Added `WorkspaceProvider` and `useWorkspaceContext` in `apps/web/src/features/workspace` to centralize authenticated app context for workspace screens.
- Replaced the older ticket-specific API/session hook with the workspace context so ticket screens do not duplicate permission logic.
- Added workspace header polish showing workspace name, current user identity, current role, workspace switcher, ticket queue link, Clerk profile control, and sign-out control.
- Added tenant access states for signed-out users, onboarding-required users, users with no workspaces, and users without membership in the requested tenant slug.
- Made ticket list, ticket detail, and new-ticket screens hide or show mutation controls using active permissions from `GET /api/me`:
  - `ticket:create`
  - `ticket:update`
  - `ticket:assign`
  - `comment:create_public`
  - `comment:create_internal`
  - `comment:read_internal`
- Added read-only messaging when a role can read tickets but cannot mutate them.
- Added `docs/ENV_SETUP.md` with Windows PowerShell setup steps for `.env`, Docker infrastructure, Prisma migrations/seeding, Clerk key configuration, public-vs-secret variables, and local smoke commands.
- Added `docs/LOCAL_AUTH_SMOKE_TEST.md` with manual real-Clerk verification steps for onboarding, profile bootstrap, workspace creation, workspace shell loading, `GET /api/me`, and signed-out behavior.
- Added `corepack pnpm env:doctor` through `scripts/env-doctor.mjs`.
- `env:doctor` checks `.env` presence, required server/frontend variables, `.env.example` completeness, local database URL shape, Redis URL, Clerk key shape, public secret exposure, and `CLERK_DEV_BEARER_AUTH=false` without printing secret values.
- Added `corepack pnpm smoke:local` through `scripts/local-smoke.mjs`.
- `smoke:local` checks `/health/live`, `/health/ready`, the web root page, and `/onboarding` without automating Clerk login.
- Added `scripts/with-root-env.mjs` so web `dev`, `build`, and `start` load the repository-root `.env` while excluding `NODE_ENV` from the forwarded environment.
- Updated browser API calls to use same-origin `/api/...` requests so Next rewrites proxy to the API and authenticated calls avoid CORS failures.
- Ran the real Clerk smoke flow through profile bootstrap, first workspace creation, workspace selector, authenticated ticket queue, and sign-out verification.
- Updated README, local development docs, and security docs to link the new environment setup and real-auth smoke checklist.
- Added frontend component test setup with Vitest, jsdom, React Testing Library, and jest-dom in `apps/web`.
- Added `corepack pnpm --filter @triageflow/web test`.
- Added Clerk and Next navigation mocks for frontend auth/session state tests without real Clerk keys.
- Added workspace shell tests covering signed-out, onboarding-required, no-workspace, active workspace, multiple-membership switcher, and invalid tenant slug states.
- Added permission-aware ticket UI tests covering viewer read-only behavior, create-ticket access, create-ticket denial, update controls, assignment controls, internal-note creation visibility, internal-note read hiding, and read-only messaging.
- Chose Vitest + React Testing Library instead of Playwright for this slice because the targeted states are deterministic component states and can be covered without browser auth automation or real Clerk sessions.
- Added tenant-owned `SlaPolicy` Prisma model with `tenant_id`, priority, first-response minutes, resolution minutes, default flag, timestamps, a tenant relation, and unique tenant/priority constraint.
- Added tenant-owned `SlaBreach` Prisma model with tenant-scoped ticket relation, breach type, breached/acknowledged timestamps, JSON metadata, and unique tenant/ticket/breach-type constraint for future worker idempotency.
- Added `SlaBreachType` enum with `first_response` and `resolution` database values.
- Added SLA migration at `packages/db/prisma/migrations/20260526193000_sla_foundation/migration.sql`.
- Added SLA indexes for `sla_policies(tenant_id, priority)`, `sla_breaches(tenant_id, ticket_id, breach_type)`, and `sla_breaches(tenant_id, breached_at)`.
- Added demo seed SLA policies for each priority:
  - LOW: first response 1440 min, resolution 10080 min
  - NORMAL: first response 480 min, resolution 4320 min
  - HIGH: first response 120 min, resolution 1440 min
  - URGENT: first response 30 min, resolution 480 min
- Added `SlaModule`, `SlaService`, and `SlaRepository` in the API.
- Added deterministic 24/7 elapsed-time deadline calculation helpers and satisfaction/breach detection helpers.
- Added tenant-scoped SLA policy lookup and idempotent breach creation behavior.
- Added SLA service tests for low/normal/high/urgent deadlines, first-response/resolution calculations, satisfaction checks, breach detection, no-breach cases, and repository delegation.
- Added SLA repository tests for tenant-scoped policy lookup, cross-tenant policy isolation, tenant-scoped breach creation, and duplicate breach idempotency.
- Integrated tenant-scoped SLA policy lookup into ticket creation inside `TicketApiService`.
- Ticket creation now assigns `first_response_due_at` and `resolution_due_at` from the current tenant's SLA policy for the ticket priority.
- Missing SLA policy configuration rejects ticket creation with typed `SLA_POLICY_NOT_FOUND`; the ticket and `ticket.created` audit log are not written when lookup fails.
- Preserved transactional ticket creation plus `ticket.created` audit logging, with SLA deadline fields included in the audit `after` payload.
- Added ticket API tests covering SLA deadline assignment for LOW, NORMAL, HIGH, and URGENT tickets; tenant-scoped missing-policy behavior; no partial ticket/audit writes on SLA lookup failure; and existing successful audit creation.
- Integrated first-response SLA satisfaction into comment creation. The first public comment authored by an internal user sets `ticket.first_responded_at` if it is currently null.
- Internal notes and requester-authored public comments do not satisfy first response.
- Additional public internal-user comments do not overwrite `first_responded_at`.
- First-response timestamp updates use tenant-scoped ticket updates in the same transaction as comment creation and comment audit logging.
- Updated ticket status transitions so `resolved_at` and `closed_at` are first timestamps: entering `RESOLVED` or `CLOSED` sets the field only when it is currently null.
- Reopening from `RESOLVED` or `CLOSED` keeps historical `resolved_at` and `closed_at`; future analytics can use audit logs/status history for reopen tracking.
- Added tests for first public agent comment satisfaction, no overwrite on later public comments, internal note exclusion, requester-authored comment exclusion, tenant-scoped first-response updates, comment audit preservation, resolved/closed timestamp behavior, reopen behavior, and invalid transition timestamp safety.
- Added BullMQ SLA worker registration in `apps/worker` for queue `sla` and job `check-breaches`.
- Added worker-local Prisma and runtime config modules using the existing shared config validation and `REDIS_URL`.
- Added `SlaBreachCheckService` to scan bounded batches of tickets with overdue first-response or resolution deadlines and record breach rows.
- Added `SlaBreachRepository` with bounded potential-breach queries, optional tenant filtering, and idempotent duplicate-breach handling through the existing unique tenant/ticket/breach-type constraint.
- Added manual one-off command `corepack pnpm worker:sla:check` for local SLA breach checks after the worker has been built.
- Added worker tests for first-response breach creation, first-response satisfaction exclusion, resolution breach creation, resolution satisfaction exclusion, repeated-run idempotency, tenant filter forwarding, batch limit forwarding/query capping, no eligible tickets, and duplicate unique-constraint handling.
- Updated `pnpm-lock.yaml` after adding worker package test/dependency metadata.
- Added repeatable BullMQ scheduling for the SLA `check-breaches` job using stable scheduler id `sla:check-breaches:every-interval`.
- Added configurable `SLA_CHECK_INTERVAL_SECONDS`, defaulting to 60 seconds, with shared config validation and `.env.example` coverage.
- Added retry/backoff and retention options for scheduled SLA checks: 3 attempts, exponential 5 second backoff, completed jobs retained for 1 day or 1000 jobs, failed jobs retained for 7 days or 1000 jobs.
- Added startup scheduling through `SlaSchedulerService`; Redis/queue registration failures are logged without throwing out of module initialization.
- Added queue status observability through `corepack pnpm worker:queues:status`, reporting waiting, active, completed, failed, delayed, and repeatable scheduler metadata.
- Improved worker logs with job id, job name, start timestamp, completion timestamp, duration, scanned ticket count, created breach count, duplicate breach count, and failure messages.
- Added worker tests for stable repeatable scheduler identity, repeated startup upsert behavior, custom interval handling, invalid interval rejection, queue status reporting, and retry/backoff/retention options.
- Added tenant-owned `AnalyticsDailyRollup` Prisma model with one UTC calendar-day row per tenant.
- Added analytics migration at `packages/db/prisma/migrations/20260527090000_analytics_daily_rollups/migration.sql`.
- Added unique and lookup indexes for `analytics_daily_rollups(tenant_id, date)`.
- Added `AnalyticsModule`, `AnalyticsRepository`, and `AnalyticsService` in the API.
- Added daily rollup fields for opened, resolved, closed, public comments, internal notes, first-response SLA breaches, resolution SLA breaches, average first-response seconds, and average resolution seconds.
- Added deterministic UTC day-boundary helpers; tenant timezone calendars and business-hours analytics remain out of scope.
- Added API-side overview foundation for tenant-scoped ticket status counts, SLA breach counts, unresolved SLA breach counts, and average lifecycle durations.
- Added analytics repository tests for opened/resolved/closed counts, comment visibility counts, SLA breach counts, average duration calculations, idempotent tenant/date upsert shape, tenant-scoped rollup reads, empty-day behavior, and UTC boundary behavior.
- Added BullMQ analytics queue constants for queue `analytics` and job `rollup-daily`.
- Added worker-local analytics rollup repository/service that calculates one tenant/date UTC daily rollup and upserts by the existing unique tenant/date key.
- Chose bounded analytics worker behavior: one tenant and one UTC date per job. If `date` is omitted, the worker defaults to yesterday UTC.
- Added `AnalyticsRollupWorker` to process `rollup-daily` jobs without importing API controllers or HTTP-layer modules.
- Added analytics queue service and module for enqueueing rollup jobs and reporting queue counts.
- Extended `corepack pnpm worker:queues:status` so it reports both SLA and analytics queue counts.
- Added manual enqueue command `corepack pnpm worker:analytics:rollup -- --tenant <tenant-uuid> --date YYYY-MM-DD`.
- Added worker tests for analytics tenant/date rollup execution, repeated-run idempotency, invalid date rejection, missing tenant rejection, tenant isolation at the service boundary, default-date behavior, queue options, queue status reporting, and manual command argument parsing.
- Added `analytics:read` permission to demo seed data and authenticated onboarding RBAC definitions.
- Granted `analytics:read` to owner/admin roles by default. Agent/viewer roles do not receive analytics access initially.
- Added protected analytics API endpoints:
  - `GET /api/tenants/:tenantSlug/analytics/overview`
  - `GET /api/tenants/:tenantSlug/analytics/daily-rollups?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Added backend permission mapping requiring `analytics:read` for both analytics endpoints.
- Added daily rollup query validation for `YYYY-MM-DD` UTC dates, `from <= to`, and maximum 90-day inclusive ranges.
- Daily rollup endpoint returns existing rollup rows only; it does not calculate missing rollups synchronously in the request path.
- Added analytics controller tests for unauthenticated denial, missing membership denial, missing permission denial, owner/admin access, tenant-specific permission behavior, tenant-scoped overview counts, tenant-scoped daily rollup rows, invalid dates, reversed ranges, too-large ranges, empty rollup ranges, and cross-tenant rollup isolation.
- Added frontend route `/[tenantSlug]/analytics` inside the existing authenticated workspace shell.
- Added permission-aware Analytics navigation in the workspace header. Users with `analytics:read` see the link; users without it do not.
- Added typed frontend API client methods:
  - `getAnalyticsOverview(tenantSlug)`
  - `getAnalyticsDailyRollups(tenantSlug, from, to)`
- Added `AnalyticsDashboardClient` with overview metric cards, last-14-UTC-days daily rollup table, loading state, backend error state, empty rollup state, and frontend access-denied state for users without `analytics:read`.
- Added duration formatting for average first-response and resolution metrics; null averages render as `No data yet`.
- Added UI helper text clarifying that daily rollups reflect generated rows and missing dates may remain empty until rollup jobs run.
- Added frontend tests for analytics navigation visibility, overview rendering, daily rollup rows, null average display, access-denied behavior, API error rendering, empty rollup ranges, and duration formatting.
- Added analytics scheduler configuration:
  - `ANALYTICS_ROLLUP_SCHEDULE_ENABLED`, default `false`
  - `ANALYTICS_ROLLUP_INTERVAL_SECONDS`, default `3600`
  - `ANALYTICS_ROLLUP_TENANT_BATCH_SIZE`, default `100`
- Added `.env.example` and shared config validation coverage for analytics scheduler settings.
- Added repeatable BullMQ scheduler registration for queue `analytics`, job `schedule-daily-rollups`, stable scheduler id `analytics:schedule-daily-rollups:every-interval`.
- Analytics scheduling is disabled by default. When enabled, worker startup upserts the repeatable scheduler with the configured interval and does not create duplicate scheduler entries on restart.
- Added `AnalyticsScheduleDailyRollupsService` to target yesterday UTC by default, fetch a bounded first batch of tenants, and enqueue one deterministic `rollup-daily` job per tenant/date.
- Daily rollup jobs scheduled by the analytics scheduler use deterministic job ids: `analytics:rollup-daily:<tenantId>:<YYYY-MM-DD>`.
- Added worker-side bounded tenant enumeration ordered by tenant creation time. Cursor/pagination across all tenants remains a future improvement.
- Added manual scheduler enqueue command `corepack pnpm worker:analytics:schedule-once -- --date YYYY-MM-DD --limit 25`.
- Extended queue status observability so analytics repeatable scheduler metadata appears through `corepack pnpm worker:queues:status`.
- Added scheduler tests for enabled/disabled registration, stable scheduler id, repeated scheduler upsert behavior, custom interval, invalid interval rejection, invalid batch size rejection, yesterday-UTC targeting, configured tenant batch limits, tenant/date job enqueueing, deterministic daily job ids, scheduler metadata in queue status, and manual scheduler args.

## Commands

Install dependencies:

```bash
corepack pnpm install
```

Start local infrastructure:

```bash
corepack pnpm infra:up
```

Run validation:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm --filter @triageflow/api test
corepack pnpm test
$env:DATABASE_URL='postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public'; corepack pnpm db:validate
$env:DATABASE_URL='postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public'; corepack pnpm db:migrate:deploy
```

Validate Prisma schema:

```bash
corepack pnpm db:validate
```

Apply migrations after PostgreSQL is running:

```bash
corepack pnpm db:migrate
```

Generate Prisma Client:

```bash
corepack pnpm db:generate
```

Seed demo RBAC data after migrations are applied:

```bash
corepack pnpm db:seed
```

Reset local database if needed:

```bash
corepack pnpm db:reset
```

Run API health smoke test after local infrastructure is up and the API is running:

```bash
Invoke-RestMethod -Uri 'http://localhost:3001/health/live'
Invoke-RestMethod -Uri 'http://localhost:3001/health/ready'
```

Run development processes:

```bash
corepack pnpm --filter @triageflow/web dev
corepack pnpm --filter @triageflow/api dev
corepack pnpm --filter @triageflow/worker dev
```

Run an analytics daily rollup job after building the worker:

```bash
corepack pnpm worker:analytics:rollup -- --tenant <tenant-uuid> --date YYYY-MM-DD
```

## Validation Results

Commands run on 2026-05-26:

```bash
corepack pnpm install
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
.\packages\db\node_modules\.bin\prisma.CMD validate --schema packages\db\prisma\schema.prisma
.\packages\db\node_modules\.bin\prisma.CMD generate --schema packages\db\prisma\schema.prisma
.\packages\db\node_modules\.bin\prisma.CMD migrate diff --from-empty --to-schema-datamodel packages\db\prisma\schema.prisma --script
.\packages\db\node_modules\.bin\prisma.CMD migrate deploy --schema packages\db\prisma\schema.prisma
docker-compose -f infra/docker-compose.yml ps
corepack pnpm db:validate
corepack pnpm db:generate
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
.\packages\db\node_modules\.bin\prisma.CMD migrate diff --from-empty --to-schema-datamodel packages\db\prisma\schema.prisma --script
GET http://localhost:3101/health/live
GET http://localhost:3101/health/ready
corepack pnpm --filter @triageflow/api test
corepack pnpm --filter @triageflow/api typecheck
corepack pnpm test
$env:DATABASE_URL='postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public'; corepack pnpm db:seed
corepack pnpm --filter @triageflow/web typecheck
corepack pnpm install --force
corepack pnpm --filter @triageflow/web typecheck
corepack pnpm --filter @triageflow/api test
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
GET http://localhost:3000/onboarding
GET http://localhost:3000/demo/tickets
corepack pnpm env:doctor
corepack pnpm smoke:local
corepack pnpm --filter @triageflow/web typecheck
corepack pnpm --filter @triageflow/web test
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
```

Results:

- Dependency install: pass.
- Lockfile generation/update: pass. `pnpm-lock.yaml` exists and includes `dotenv-cli`.
- Frozen lockfile install: pass.
- Lint: pass.
- Typecheck: pass.
- Build: pass.
- Prisma schema validation: pass.
- Prisma Client generation: pass.
- Root `db:validate` script: pass.
- Root `db:generate` script: pass.
- Prisma offline migration diff from empty schema: pass.
- Docker Compose service check: pass using `docker-compose -f infra/docker-compose.yml ps`.
- Prisma migration apply: pass against local Docker PostgreSQL on `localhost:5432`.
- Prisma demo seed: pass.
- Seed verification counts: 1 tenant, 4 users, 4 memberships, 4 roles, 6 permissions, 16 role-permission links, 3 requesters, 3 tickets.
- Ticket domain migration apply: pass against local Docker PostgreSQL on `localhost:5432`.
- Prisma migration diff: pass.
- API health smoke test: pass. `/health/live` returned `{"status":"ok","service":"api"}`.
- API readiness smoke test: pass. `/health/ready` returned config, database, and Redis checks as `up`.
- API auth/RBAC guard tests: pass. 5 tests cover unauthenticated, no membership, allowed membership, different roles across tenants, and missing permission.
- Ticket repository/service tests: pass. 20 tests cover tenant scoping, requester and assignee tenant constraints, required `RequestContext`, not-found behavior, and valid/invalid status transitions.
- Audit log migration apply: pass against local Docker PostgreSQL on `localhost:5432`.
- Audit service tests: pass. 5 tests cover required audit fields, tenant scoping, cross-tenant isolation, filtered tenant reads, and transaction client usage.
- Ticket controller integration tests: pass. 11 tests cover RBAC, tenant isolation, invalid transitions, audit logging, and tenant-specific role differences.
- Ticket comments migration apply: pass against local Docker PostgreSQL on `localhost:5432`.
- Prisma demo seed after comment permissions: pass.
- Comment controller integration tests: pass. 10 tests cover public comments, internal note permissions, internal note visibility filtering, tenant isolation, audit logging, and body validation.
- API test command: pass. 51 total API tests pass.
- Web route smoke check: pass. `http://localhost:3000/demo/tickets` returned HTTP 200 from the local Next.js dev server.
- Browser smoke check: pass. The demo ticket queue rendered seeded backend tickets through the Next.js API rewrite without a request error.
- Clerk auth provider tests: pass. 5 tests cover missing token, invalid token, valid token mapping, development fallback, and non-development fallback denial.
- Debug endpoint production availability test: pass. The debug context endpoint returns `404` under production config.
- API test command: pass. 57 total API tests pass.
- Next.js upgrade validation: pass. `corepack pnpm --filter @triageflow/web typecheck` passes on Next.js 16.2.6.
- Local frontend check: pass. `http://localhost:3000/demo/tickets` returned HTTP 200 and rendered the TriageFlow support desk shell with Clerk sign-in/authentication-required state in the browser.
- Onboarding API tests: pass. 7 tests cover onboarding-required `/api/me`, idempotent profile bootstrap, transactional first-workspace creation, duplicate slug rejection, no membership grant to existing tenants, and tenant-specific membership/permission serialization.
- Lint after onboarding slice: pass.
- Typecheck after onboarding slice: pass.
- Build after onboarding slice: pass.
- Full workspace test command after onboarding slice: pass. 64 total API tests pass.
- Frontend onboarding smoke check: pass. `http://localhost:3000/onboarding` returned HTTP 200 and rendered the TriageFlow workspace setup sign-in state in the browser.
- Workspace header polish validation: pass.
- Web app typecheck after workspace shell changes: pass.
- Signed-out browser smoke check after workspace shell changes: pass. `/demo/tickets` renders the shared workspace shell sign-in/authentication-required state without seeded-provider UI text.
- Environment doctor: pass in this workspace. A local `.env` exists and all checked values are present; the command did not print secret values.
- Local reachability smoke helper: pass. API live/ready health, web root, and `/onboarding` were reachable.
- Real Clerk smoke test: pass after restarting API/web with current builds and env. `/api/me` routed correctly, profile bootstrap succeeded, workspace creation succeeded, the new workspace queue rendered the Owner shell and empty ticket state, and sign-out returned to the public home page.
- Web build with root env wrapper: pass. The wrapper excludes `.env` `NODE_ENV`, preventing Next production build from running with `NODE_ENV=development`.
- Frontend component test command: pass. 13 tests cover workspace shell states and permission-aware ticket UI.
- SLA migration deploy: pass against local PostgreSQL.
- SLA seed: pass. Demo tenant SLA defaults were upserted.
- API tests after SLA foundation: pass. 80 API tests pass.
- SLA ticket creation integration validation: pass.
- Prisma schema validation after SLA ticket creation integration: pass.
- Prisma Client generation after SLA ticket creation integration: pass.
- Lint after SLA ticket creation integration: pass.
- Typecheck after SLA ticket creation integration: pass.
- Build after SLA ticket creation integration: pass.
- API tests after SLA ticket creation integration: pass. 85 API tests pass.
- Root test command after SLA ticket creation integration: pass. 85 API tests and 13 web tests pass.
- SLA satisfaction timestamp integration validation: pass.
- Prisma schema validation after SLA satisfaction timestamp integration: pass.
- Prisma Client generation after SLA satisfaction timestamp integration: pass.
- Lint after SLA satisfaction timestamp integration: pass.
- Typecheck after SLA satisfaction timestamp integration: pass.
- Build after SLA satisfaction timestamp integration: pass.
- API tests after SLA satisfaction timestamp integration: pass. 96 API tests pass.
- Root test command after SLA satisfaction timestamp integration: pass. 96 API tests and 13 web tests pass.
- SLA breach worker validation: pass.
- Lint after SLA breach worker integration: pass.
- Typecheck after SLA breach worker integration: pass.
- Build after SLA breach worker integration: pass.
- API tests after SLA breach worker integration: pass. 96 API tests pass.
- Worker tests after SLA breach worker integration: pass. 11 worker tests pass.
- Root test command after SLA breach worker integration: pass. 96 API tests, 11 worker tests, and 13 web tests pass.
- Prisma schema validation after SLA breach worker integration: pass.
- Prisma Client generation after SLA breach worker integration: pass.
- SLA repeatable scheduling and worker observability validation: pass.
- Lint after SLA scheduling and observability: pass.
- Typecheck after SLA scheduling and observability: pass.
- Build after SLA scheduling and observability: pass.
- Worker tests after SLA scheduling and observability: pass. 18 worker tests pass.
- API tests after SLA scheduling and observability: pass. 96 API tests pass.
- Root test command after SLA scheduling and observability: pass. 96 API tests, 18 worker tests, and 13 web tests pass.
- Prisma schema validation after SLA scheduling and observability: pass.
- Prisma Client generation after SLA scheduling and observability: pass.
- Analytics rollup schema and service foundation validation: pass.
- Prisma schema validation after analytics foundation: pass.
- Prisma Client generation after analytics foundation: pass.
- Prisma migration deploy after analytics foundation: pass after starting local Docker PostgreSQL with `corepack pnpm infra:up`.
- Lint after analytics foundation: pass.
- Typecheck after analytics foundation: pass.
- Build after analytics foundation: pass.
- API tests after analytics foundation: pass. 104 API tests pass.
- Worker tests after analytics foundation: pass. 18 worker tests pass.
- Web tests after analytics foundation: pass. 13 web tests pass.
- Root test command after analytics foundation: pass. 104 API tests, 18 worker tests, and 13 web tests pass.
- Analytics rollup worker validation: pass.
- Prisma schema validation after analytics rollup worker: pass.
- Prisma Client generation after analytics rollup worker: pass.
- Lint after analytics rollup worker: pass.
- Typecheck after analytics rollup worker: pass.
- Build after analytics rollup worker: pass.
- Worker tests after analytics rollup worker: pass. 30 worker tests pass.
- API tests after analytics rollup worker: pass. 104 API tests pass.
- Web tests after analytics rollup worker: pass. 13 web tests pass.
- Root test command after analytics rollup worker: pass. 104 API tests, 30 worker tests, and 13 web tests pass.
- Targeted analytics controller test after analytics endpoint implementation: pass. 11 analytics controller tests pass.
- Protected analytics API endpoint validation: pass.
- Prisma schema validation after analytics API endpoints: pass.
- Prisma Client generation after analytics API endpoints: pass.
- Lint after analytics API endpoints: pass.
- Typecheck after analytics API endpoints: pass.
- Build after analytics API endpoints: pass.
- API tests after analytics API endpoints: pass. 115 API tests pass.
- Worker tests after analytics API endpoints: pass. 30 worker tests pass.
- Web tests after analytics API endpoints: pass. 13 web tests pass.
- Root test command after analytics API endpoints: pass. 115 API tests, 30 worker tests, and 13 web tests pass.
- Targeted web validation after frontend analytics dashboard: pass. 21 web tests pass and web typecheck passes.
- Frontend analytics dashboard validation: pass.
- Lint after frontend analytics dashboard: pass.
- Typecheck after frontend analytics dashboard: pass.
- Build after frontend analytics dashboard: pass.
- Web tests after frontend analytics dashboard: pass. 21 web tests pass.
- API tests after frontend analytics dashboard: pass. 115 API tests pass.
- Worker tests after frontend analytics dashboard: pass. 30 worker tests pass.
- Root test command after frontend analytics dashboard: pass. 115 API tests, 30 worker tests, and 21 web tests pass.
- Analytics scheduling validation: pass.
- Prisma schema validation after analytics scheduling: pass.
- Prisma Client generation after analytics scheduling: pass.
- Typecheck after analytics scheduling: pass.
- Lint after analytics scheduling: pass.
- Build after analytics scheduling: pass.
- Worker tests after analytics scheduling: pass. 42 worker tests pass.
- API tests after analytics scheduling: pass. 115 API tests pass.
- Web tests after analytics scheduling: pass. 21 web tests pass.
- Root test command after analytics scheduling: pass. 115 API tests, 42 worker tests, and 21 web tests pass.
- Ticket/comment cursor pagination validation: pass.
- Prisma schema validation after cursor pagination: pass.
- Prisma Client generation after cursor pagination: pass.
- Lint after cursor pagination: pass after restoring an explicit `CommentRecord` repository type.
- Typecheck after cursor pagination: pass after tightening optional cursor parsing for `exactOptionalPropertyTypes`.
- Build after cursor pagination: pass.
- API tests after cursor pagination: pass. 124 API tests pass.
- Web tests after cursor pagination: pass. 24 web tests pass.
- Worker tests after cursor pagination: pass. 42 worker tests pass.
- Root test command after cursor pagination: pass. 124 API tests, 42 worker tests, and 24 web tests pass.
- Benchmark harness validation: pass for scripts/docs and large local seed.
- Large seed dry-run after benchmark harness: pass.
- Large seed against local Docker PostgreSQL after benchmark harness: pass in about 130 seconds.
- Large seed row counts verified by script output: 10 tenants, 500 users, 500 memberships, 1,000 requesters, 50,000 tickets, 250,000 comments, 500,000 audit logs, 5,116 SLA breaches, and 300 analytics daily rollups.
- Benchmark seed printed `bench-large` tenant id `2f3c4423-e6f2-58f5-8afa-deceb2850ec5`, default bearer token `clerk_bench_owner`, and assignee user id `dd0b8ce1-9900-5997-b3aa-49708775cb7e`.
- k6 smoke run after benchmark harness: not run because `k6` is not installed locally and the API was not reachable on `localhost:3001` at validation time.
- Local API/web smoke after k6 install: pass.
- API started with `.env` loaded and `CLERK_DEV_BEARER_AUTH=true` for local benchmark auth.
- `corepack pnpm smoke:local`: pass for API live, API ready, web root, and web onboarding.
- Authenticated benchmark API checks: pass for `GET /api/tenants/bench-large/tickets?limit=2` and `GET /api/tenants/bench-large/analytics/overview`.
- k6 ticket-list smoke: pass with 1 VU for 30s, 0% failures, ticket-list p95 38.23ms, status p95 12.44ms, priority p95 12.63ms, assignee p95 13.88ms, cursor p95 31.44ms.
- k6 comments smoke: pass with 1 VU for 30s, 0% failures, comments-list p95 13.14ms.
- k6 mixed-workload smoke: pass with 1 VU for 30s, 0% failures, read p95 31.99ms; covered ticket list, ticket detail, comments list, analytics overview, and analytics daily rollups.
- k6 wrapper smoke after runner hardening: pass for tickets/comments/mixed with 1 VU for 30s, 0% failures, and JSON summaries captured under ignored `benchmark-results/local`:
  - `tickets-2026-05-27T11-40-26-052Z.json`: ticket-list p95 41.53ms, status p95 17.43ms, priority p95 12.15ms, assignee p95 12.83ms, cursor p95 31.36ms.
  - `comments-2026-05-27T11-42-05-534Z.json`: comments-list p95 13.38ms.
  - `mixed-2026-05-27T11-42-05-555Z.json`: read p95 34.58ms; covered ticket list, ticket detail, comments list, analytics overview, and analytics daily rollups.
- Benchmark runner hardening added:
  - `scripts/run-k6.mjs` resolves `K6_BIN`, PATH `k6`, or Windows `C:\Program Files\k6\k6.exe`.
  - `corepack pnpm bench:k6:tickets`, `bench:k6:comments`, and `bench:k6:mixed` now run through the wrapper.
  - k6 summary JSON is exported to `benchmark-results/local/<benchmark>-<timestamp>.json` by default.
  - `BENCH_OUTPUT_DIR` can override the output directory.
- Benchmark result capture convention added:
  - `benchmark-results/README.md`
  - `benchmark-results/.gitkeep`
  - `benchmark-results/local/.gitkeep`
  - raw local result JSON ignored by git.
- Benchmark report template added at `docs/BENCHMARK_REPORT_TEMPLATE.md`.
- Query-plan guide added at `docs/QUERY_PLANS.md`.
- Benchmark row-count helper added:
  - `corepack pnpm db:bench:counts`
- Full local benchmark baseline captured on 2026-05-27:
  - `corepack pnpm bench:k6:tickets`
  - `corepack pnpm bench:k6:comments`
  - `corepack pnpm bench:k6:mixed`
  - Environment: `API_BASE_URL=http://localhost:3001`, `TENANT_SLUG=bench-large`, `BENCH_AUTH_TOKEN=clerk_bench_owner`, `BENCH_ASSIGNEE_USER_ID=dd0b8ce1-9900-5997-b3aa-49708775cb7e`, `VUS=20`, `DURATION=5m`.
  - Final p99-capable result files read: `tickets-2026-05-27T12-04-37-646Z.json`, `comments-2026-05-27T12-09-49-166Z.json`, and `mixed-2026-05-27T12-14-58-006Z.json`.
  - Ticket-list p95s: unfiltered 42.00ms, status 20.42ms, priority 19.59ms, assignee 20.00ms, cursor 43.58ms.
  - Comments-list p95: 25.90ms.
  - Mixed read p95: 96.96ms.
  - All three full k6 runs had 0% request failures.
  - The p95 under 150ms target was met for all measured k6 thresholds.
- Dated benchmark evidence added:
  - `docs/benchmarks/2026-05-27-local-baseline.md`
  - `docs/benchmarks/2026-05-27-query-plans.md`
- k6 benchmark scripts now export p99 through `summaryTrendStats` for report capture.
- Query-plan evidence captured:
  - Tenant/status and tenant/priority ticket lists used index scans and completed in about 0.1ms.
  - Tenant/assignee/status ticket list used the composite index through bitmap index scan and completed in about 0.24ms.
  - Comment timeline used the tenant/ticket/created_at index and completed in about 0.17ms.
  - Unfiltered ticket list and unfiltered cursor page used sequential scans with top-N sorts but still completed around 14ms locally; this is a future optimization candidate, not an immediate index change.
- Benchmark-driven ticket tenant/order index added:
  - Prisma index: `@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)], map: "tickets_tenant_id_created_at_id_desc_idx")`.
  - Migration: `20260527123000_ticket_tenant_order_index`.
  - Direct query-plan before/after: unfiltered ticket list changed from sequential scan + top-N sort at about 13.59ms to index scan at about 0.14ms; cursor page changed from sequential scan + top-N sort at about 14.21ms to index scan at about 0.08ms.
  - Focused k6 post-index result file: `tickets-2026-05-27T22-44-08-170Z.json`.
  - Focused k6 post-index p95s: unfiltered ticket list 17.59ms, cursor page 19.00ms, status 19.56ms, priority 19.22ms, assignee 20.10ms, 0% failures.
  - Optional mixed workload post-index result file: `mixed-2026-05-27T22-49-20-469Z.json`; p95 74.95ms, 0% failures.
  - Optimization report added at `docs/benchmarks/2026-05-27-index-optimization.md`.
  - Tradeoff decision: keep the index because it directly matches the measured hot unfiltered queue/cursor path; accepted cost is one extra ticket index with insert-time write amplification and disk usage.

## Benchmark Seed And k6 Harness

Added opt-in local benchmark infrastructure:

- `scripts/seed-large.mjs`
- `infra/k6/ticket-list.js`
- `infra/k6/comments.js`
- `infra/k6/mixed-workload.js`

Seed command:

- `corepack pnpm db:seed:large`
- `corepack pnpm db:seed:large:dry-run`

Target default dataset:

- 10 benchmark tenants with `bench-` slugs.
- 1 large tenant, `bench-large`, with about 25k tickets.
- 9 smaller tenants sharing the remaining about 25k tickets.
- 500 benchmark users.
- 50,000 tickets.
- 250,000 comments.
- 500,000 audit logs.
- SLA policies for every benchmark tenant and priority.
- Representative SLA breaches.
- 30 UTC days of analytics daily rollups.

Seed safety:

- The large seed is deterministic.
- It is not part of normal `db:seed`.
- It clears and recreates only tenants whose slug starts with `bench-`.
- It deletes only users whose provider id starts with `clerk_bench_`.
- It leaves normal demo seed data intact.

k6 commands:

- `corepack pnpm bench:k6:tickets`
- `corepack pnpm bench:k6:comments`
- `corepack pnpm bench:k6:mixed`
- `K6_BIN` can point to a specific k6 executable when PATH is stale.
- k6 summary exports are written to `benchmark-results/local` unless `BENCH_OUTPUT_DIR` is set.

Benchmark auth strategy:

- Uses existing development bearer auth fallback.
- Default bearer token/provider id: `clerk_bench_owner`.
- Requires API process environment `NODE_ENV=development` and `CLERK_DEV_BEARER_AUTH=true`.
- This fallback is ignored outside development and must not be enabled for production.

k6 env vars:

- `API_BASE_URL`, default `http://localhost:3001`.
- `TENANT_SLUG`, default `bench-large`.
- `BENCH_AUTH_TOKEN`, default `clerk_bench_owner`.
- `BENCH_ASSIGNEE_USER_ID`, optional for assignee-filter coverage.
- `DURATION`, default `5m`.
- `VUS`, default `20`.

Known limitations:

- k6 must be installed on the developer machine; it is not an npm dependency.
- The mixed workload is read-heavy only for now; write benchmarks are deferred so repeated runs do not grow audit logs or alter ticket state.
- Query-plan helper commands are documented in `docs/QUERY_PLANS.md` but not automated.
- Large seed runtime depends heavily on local Docker/PostgreSQL resources.
- k6 is installed at `C:\Program Files\k6\k6.exe`; this PowerShell session did not resolve `k6` from PATH, so smoke runs used the absolute executable path.

## Cursor Pagination

Implemented for:

- `GET /api/tenants/:tenantSlug/tickets`
- `GET /api/tenants/:tenantSlug/tickets/:ticketId/comments`

API cursor format:

- Opaque base64url JSON.
- Internal decoded fields: `createdAt` and `id`.
- Tenant scope is not accepted from cursor input and remains derived only from `RequestContext`.
- Invalid cursors return structured `VALIDATION_ERROR` responses.

Endpoint behavior:

- Ticket lists return `{ items, nextCursor, hasMore }`, order by `created_at DESC, id DESC`, support `limit` default 50/max 100, and preserve `status`, `priority`, and `assigneeUserId` filters.
- Comment lists return `{ items, nextCursor, hasMore }`, order by `created_at ASC, id ASC` for conversation timelines, support `limit` default 50/max 100, and preserve public/internal visibility filtering.
- Repository methods remain tenant-scoped and no offset pagination was added.

Frontend behavior:

- Ticket queue uses a `Load more` button, appends pages without duplicate rows, and resets pagination when filters change.
- Ticket detail conversation uses a `Load newer comments` button for the oldest-first comment timeline.
- Comment creation appends the created comment locally while preserving existing backend authorization and audit behavior.

Tests added or updated:

- API tests for ticket first page limits, `nextCursor`, duplicate-free second pages, deterministic same-timestamp ordering, invalid cursors, filter preservation, and tenant-scoped paging.
- API tests for comment first page limits, next-page cursor behavior, invalid cursors, public/internal visibility, deterministic same-timestamp ordering, and cross-tenant denial.
- Frontend component tests for ticket load-more behavior, filter pagination reset, and comment pagination.

Notes:

- `next build` emits a non-failing warning that the Next.js plugin was not detected in ESLint configuration. Root `corepack pnpm lint` passes and includes the web app.
- Local `pnpm` is not directly available on PATH in this environment, so verified commands use `corepack pnpm`.
- Docker Desktop is available through `docker-compose.exe` in this environment. The newer `docker compose` plugin command is not available here.
- Prisma currently warns that `package.json#prisma` seed configuration is deprecated for Prisma 7. The current project uses Prisma 6.19.3.
- Root `corepack pnpm db:validate` requires `DATABASE_URL`. It failed when no `.env` file existed, then passed with the local Docker `DATABASE_URL` supplied in the shell.

## Live PostgreSQL API Integration Harness

Added a focused live database integration path for critical API behavior:

- Root command: `corepack pnpm test:integration`.
- API command: `corepack pnpm --filter @triageflow/api test:integration`.
- Runner: `scripts/api-integration-test.mjs`.
- Vitest config: `apps/api/vitest.integration.config.ts`.
- Live suite: `apps/api/src/integration/api.live.integration-spec.ts`.
- Test harness utilities: `apps/api/src/integration/live-api-test-harness.ts`.

Strategy:

- Uses local PostgreSQL through `TEST_DATABASE_URL`.
- Defaults to `postgresql://triageflow:triageflow@localhost:5432/triageflow_test?schema=public`.
- Creates the test database when missing.
- Refuses to run against a database whose name does not contain `test`.
- Applies Prisma migrations with `migrate deploy` before running tests.
- Truncates test-owned tables between tests.
- Seeds only minimal tenants, users, roles, permissions, requesters, tickets, comments, SLA policies, and analytics rows.
- Overrides the `AuthIdentityProvider` with a test-header implementation, so no real Clerk keys or sessions are required.
- Uses the real Nest app, guards, repositories, Prisma service, PostgreSQL constraints, and transaction behavior.

Coverage added:

- Tenant isolation for ticket list/detail, comment list/create, requester assignment, and assignee assignment.
- Tenant-specific RBAC, including viewer read-only behavior, permitted agent update, no-membership denial, and `analytics:read` denial.
- Ticket cursor pagination using real inserted rows, same-`created_at` ordering by `id`, filter preservation, invalid cursor rejection, and no duplicate rows.
- Comment cursor pagination using oldest-first ordering, same-`created_at` ordering by `id`, public/internal filtering, invalid cursor rejection, and no duplicate rows.
- Transactional audit behavior for ticket and comment creation.
- Missing SLA policy rollback proving no partial ticket or audit log.
- First public internal-user comment setting `first_responded_at`; internal note does not.

Infrastructure fix:

- Added explicit `@Inject(AppConfigService)` to `RedisService` so the full Nest app can be instantiated in tests without relying on emitted constructor metadata.

Commands run:

- `corepack pnpm infra:up` passed; PostgreSQL and Redis containers were already running.
- `corepack pnpm --filter @triageflow/api test:integration` passed with 15 live PostgreSQL tests.
- `corepack pnpm test:integration` passed with 15 live PostgreSQL tests.
- `corepack pnpm lint` passed.
- `corepack pnpm typecheck` passed.
- `corepack pnpm build` passed.
- `corepack pnpm --filter @triageflow/api test` passed.
- `corepack pnpm --filter @triageflow/web test` passed.
- `corepack pnpm --filter @triageflow/worker test` passed.
- `corepack pnpm test` passed.
- `corepack pnpm db:validate` passed.
- `corepack pnpm db:migrate:deploy` passed.
- `corepack pnpm db:generate` was attempted but failed because Windows would not replace Prisma's `query_engine-windows.dll.node` while local Node/API processes had Prisma loaded.

Known limitations:

- The live suite is intentionally focused and does not duplicate every mocked controller/unit test.
- It requires local PostgreSQL and a reachable test database.
- The runner does not drop the test database; it truncates test-owned tables between test cases.
- The integration runner uses `shell: true` on Windows so Corepack commands resolve correctly; Node 24 emits a non-failing child-process deprecation warning for that mode.

## Portfolio And Reviewer Packaging

Added reviewer-oriented documentation:

- Rewrote `README.md` as the main 2-3 minute project landing page.
- Added `docs/README.md` as a documentation index.
- Added `docs/DEMO_SCRIPT.md` for a 3-5 minute recruiter/interview walkthrough.
- Added `docs/ARCHITECTURE_SUMMARY.md` for high-signal architectural decisions and tradeoffs.
- Added `docs/RESUME_BULLETS.md` with measured resume bullets and interview talking points.
- Added `docs/REPO_HYGIENE.md` with publication and validation checklist.

Stale state fixed:

- Removed the outdated next-task reference to evaluating the tenant/order index; that optimization is complete and documented.
- Removed the outdated not-started entry for the integration harness; it is complete and passing.
- Updated known risks to separate intentional future improvements from resolved validation gaps.
- Added `TEST_DATABASE_URL` to local environment documentation.

Commands run for this polish slice:

- `corepack pnpm db:generate` passed after stopping local TriageFlow Node/API/web processes that held Prisma's Windows query engine DLL.
- `corepack pnpm lint` passed.
- `corepack pnpm typecheck` passed.
- `corepack pnpm build` passed.
- `corepack pnpm --filter @triageflow/api test` passed.
- `corepack pnpm --filter @triageflow/api test:integration` passed.
- `corepack pnpm --filter @triageflow/web test` passed.
- `corepack pnpm --filter @triageflow/worker test` passed.
- `corepack pnpm test` passed.
- `corepack pnpm test:integration` passed.
- `corepack pnpm db:validate` passed.

## Not Started

- SLA worker dashboard/public observability
- Notifications/email delivery
- Invites/member management
- Billing
- Email ingestion
- Business-hours calendars
- Tenant timezone calendars
- Deployment/hosting hardening

## Active Constraints

- Do not implement billing, invites, email ingestion, business-hours calendars, notifications, tenant timezone calendars, or frontend redesigns during documentation/reviewer polish phases.
- Future implementation work should be delivered as small vertical slices.
- Update this file after meaningful changes.

## Next Recommended Task

Capture optional portfolio screenshots/video after starting the local app with real Clerk keys, or prepare the repository for publishing with the checklist in `docs/REPO_HYGIENE.md`.

## Known Risks

- Ticket/comment controller unit-style integration tests still use mocked Prisma behavior, but the critical tenant isolation, RBAC, pagination, audit, and transaction paths now also have a focused live PostgreSQL integration harness.
- Ticket and comment cursor pagination are implemented with `createdAt`/`id` cursors. Live query-plan inspection is captured, and the unfiltered ticket queue now has a targeted tenant/order index.
- Frontend component tests mock Clerk and API state; real Clerk sign-in/onboarding remains covered by the manual checklist in `docs/LOCAL_AUTH_SMOKE_TEST.md`.
- Viewer/agent/admin permission-specific frontend states were not manually browser-verified with real Clerk sessions in this environment. The UI now derives permissions from `GET /api/me`, but backend authorization remains authoritative.
- The frontend has Vitest/React Testing Library component coverage, but no Playwright browser automation suite yet.
- The temporary debug auth/RBAC endpoint still exists for development/test but returns `404` in production.
- SLA calculations are simple 24/7 elapsed-time math only. Business hours, holidays, timezone-specific calendars, notifications, and frontend SLA UI are not implemented.
- SLA deadlines are assigned at ticket creation only. Recalculating deadlines after priority changes is not implemented yet and should be handled deliberately in a future ticket/SLA policy task.
- SLA satisfaction timestamps are first occurrence fields. Reopen counts, repeated resolution timing, and close history are not modeled beyond audit logs yet.
- SLA breach checks are now repeatably scheduled by a running worker. Public dashboards, alerting/notifications, and analytics rollups are not implemented yet.
- Analytics daily rollups can now be calculated by a worker job for one tenant/date, read through protected `analytics:read` API endpoints, viewed in a minimal permission-aware frontend dashboard, and scheduled conservatively when explicitly enabled.
- Analytics scheduler tenant enumeration currently processes the first N tenants by creation order. Cursor-based coverage across all tenants is not implemented yet.
- Analytics rollups use UTC calendar days only. Tenant timezone-aware calendars and business-hours analytics are not implemented.
- Analytics overview averages currently derive from all available tenant ticket source data in the service foundation; large-scale production tuning should move this to rollups or indexed aggregate strategy.
