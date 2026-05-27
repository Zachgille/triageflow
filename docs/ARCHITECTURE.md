# Architecture

TriageFlow is a production-style multi-tenant support desk SaaS built as a modular monolith with a separate background worker process.

## System Boundaries

- `web`: Next.js frontend using TypeScript, Tailwind CSS, and shadcn/ui.
- `api`: NestJS + Fastify TypeScript API. This process owns request validation, tenant resolution, authorization, business workflows, and synchronous reads/writes.
- `worker`: BullMQ worker process for SLA checks, SLA breach detection, notifications, and analytics rollups.
- `postgres`: PostgreSQL database accessed through Prisma and migrations.
- `redis`: Redis instance used by BullMQ for queues, scheduled jobs, retries, and job coordination.

The web application calls the API. The API reads and writes PostgreSQL, enqueues jobs in Redis, and returns responses. Workers consume jobs from Redis and update PostgreSQL through the same tenant-scoped data-access rules used by API services.

## Modular Monolith

The backend is organized by modules inside one deployable API codebase. Modules should map to business capabilities such as tenants, users, memberships, tickets, comments, audit logs, SLA policies, notifications, and analytics.

This is not a microservices architecture. Modules do not own independent databases, expose internal network APIs to each other, or require distributed transactions. The first production target favors strong consistency, simpler deployment, shared transactions, and easier refactoring over service-level independence.

The worker is a separate runtime process for operational reasons, not a separate business service. It shares the same database and must respect the same authorization, tenancy, idempotency, and audit rules where applicable.

## Tenant Isolation

TriageFlow uses pooled tenancy. Tenant-owned rows from all tenants live in shared PostgreSQL tables and are isolated by `tenant_id`.

Rules:

- Every tenant-owned table must include `tenant_id`.
- Every tenant-owned query must filter by `tenant_id`.
- Every tenant-owned repository method must receive `RequestContext`.
- Cross-tenant access must fail closed.
- Database indexes must lead with or include `tenant_id` for tenant-scoped access paths.

Tenant isolation is enforced in backend data access and validated with integration and security tests. Frontend tenant selection is not a security boundary.

## RBAC Model

Clerk is used for authentication only. Application authorization is implemented in the TriageFlow database.

The RBAC model includes:

- `users`: local application users mapped to Clerk identities.
- `tenants`: customer workspaces.
- `memberships`: user membership in a tenant.
- `roles`: named sets of permissions.
- `permissions`: granular application capabilities.
- `role_permissions`: mapping between roles and permissions.

For protected endpoints, the backend must:

1. Authenticate the user.
2. Resolve the active tenant.
3. Validate an active membership for the user and tenant.
4. Resolve permissions through assigned roles.
5. Check the required permission before executing the action.

Each request produces a `RequestContext` containing `requestId`, `userId`, `tenantId`, `membershipId`, and `permissions`.

## Ticket Workflow

Tickets move through these states:

- `new`
- `open`
- `pending_customer`
- `pending_internal`
- `resolved`
- `closed`

State transitions must be validated by the backend. Important state changes must produce audit logs.

Tickets support public comments and internal notes. Internal notes require explicit backend permission checks on both write and read paths.

Tenant ticket and comment list endpoints use opaque cursor pagination at the API boundary. Cursors encode only `createdAt` and `id`; clients must treat them as opaque and tenant scoping still comes exclusively from `RequestContext`. Ticket lists are ordered by `created_at DESC, id DESC` for newest-first operational queues. Comment timelines are ordered by `created_at ASC, id ASC` for conversation readability and page forward to newer comments. Invalid cursors return validation errors, and no endpoint uses offset pagination for ticket or comment lists.

## Audit Logging

Important business mutations write an audit log in the same database transaction where practical. Audit records should capture:

- tenant
- actor
- action
- target entity type and id
- timestamp
- request id
- relevant before/after metadata when appropriate

Audit logging must be append-only from the application perspective. Audit queries must be tenant-scoped and indexed for tenant/time access patterns.

## SLA Workers

SLA policy data is tenant-owned. Each tenant can define one SLA policy per ticket priority. The initial implementation uses simple 24/7 elapsed-time calculations:

- `first_response_due_at = ticket.created_at + first_response_minutes`
- `resolution_due_at = ticket.created_at + resolution_minutes`

During ticket creation, the API looks up the current tenant's SLA policy for the ticket priority inside the same transaction used for ticket creation and audit logging. Missing policy configuration rejects ticket creation with `SLA_POLICY_NOT_FOUND`; this is treated as a tenant configuration error because the seed data creates policies for all priorities.

SLA satisfaction timestamps are maintained synchronously in the API. The first public comment authored by an internal user sets `first_responded_at` once; internal notes and requester-authored comments do not satisfy first response. Transitioning a ticket to `RESOLVED` sets `resolved_at` only if it is currently null, and transitioning to `CLOSED` sets `closed_at` only if it is currently null. Reopening keeps historical `resolved_at` and `closed_at` values; future analytics can use audit logs or status history for reopen tracking.

Business-hours calendars, holiday calendars, and timezone-specific SLA windows are intentionally out of scope for the initial SLA foundation.

SLA breach records are tenant-owned and linked to tickets through tenant-scoped foreign keys. A unique constraint on tenant, ticket, and breach type prevents duplicate first-response or resolution breaches. This database constraint is the idempotency foundation for future retried workers.

The worker process registers a BullMQ worker for queue `sla` and job `check-breaches`. The job accepts an optional `tenantId`, optional bounded `limit`, and optional `now` override for deterministic tests or local verification.

The breach check scans bounded batches of tickets with overdue `first_response_due_at` and no `first_responded_at`, or overdue `resolution_due_at` and no `resolved_at`. When `tenantId` is provided, the query is tenant-scoped. Each detected breach is written to `SlaBreach`; duplicate unique-constraint conflicts are treated as already processed so repeated worker runs are safe.

On worker startup, `SlaSchedulerService` upserts a repeatable BullMQ job scheduler using stable id `sla:check-breaches:every-interval`. The default interval is 60 seconds and is configured by `SLA_CHECK_INTERVAL_SECONDS`. The scheduled job uses 3 attempts with exponential backoff, retains completed jobs for 1 day or 1000 jobs, and retains failed jobs for 7 days or 1000 jobs so failures can be inspected without unbounded Redis growth.

Basic queue observability is available through a local CLI command that reports waiting, active, completed, failed, delayed, and repeatable scheduler metadata. No public worker dashboard is exposed yet.

## Analytics Rollups

Analytics rollups are tenant-owned daily summaries stored in `analytics_daily_rollups` with a unique tenant/date key. Dates use UTC calendar-day granularity for now. Tenant timezone calendars, business-hours windows, and holiday logic are out of scope for the initial analytics foundation.

The API-side analytics service can calculate and upsert a daily rollup for one tenant/date from source tables:

- tickets opened by `created_at`
- tickets resolved by first `resolved_at`
- tickets closed by first `closed_at`
- public comments and internal notes by comment `created_at`
- first-response and resolution SLA breach rows by `breached_at`
- average first response and resolution durations from ticket lifecycle timestamps

Rollup reads require `RequestContext` and scope by `ctx.tenantId`. The current operational overview also scopes by tenant and derives ticket status counts, SLA breach counts, and average durations from available source data.

The worker process registers a BullMQ worker for queue `analytics` and job `rollup-daily`. This job is intentionally bounded to one tenant and one UTC date. If a date is omitted, the worker defaults to yesterday UTC so local/manual runs avoid constantly mutating the active day unless explicitly requested.

Each analytics rollup job calculates source-table aggregates and upserts `analytics_daily_rollups` by the unique tenant/date key. Repeated runs for the same tenant/date update the same row, making retries and manual reruns idempotent.

Analytics scheduling is conservative and disabled by default. When `ANALYTICS_ROLLUP_SCHEDULE_ENABLED=true`, worker startup upserts stable BullMQ scheduler id `analytics:schedule-daily-rollups:every-interval` on queue `analytics`, job `schedule-daily-rollups`. The default interval is hourly via `ANALYTICS_ROLLUP_INTERVAL_SECONDS=3600`.

The scheduler job targets yesterday UTC, loads a bounded first batch of tenants limited by `ANALYTICS_ROLLUP_TENANT_BATCH_SIZE`, and enqueues one deterministic `rollup-daily` job per tenant/date using job id `analytics:rollup-daily:<tenantId>:<YYYY-MM-DD>`. This prevents unbounded fanout and duplicate job buildup for the same tenant/date. The current scheduler processes the first N tenants by creation order; cursor/pagination across very large tenant sets remains a future scheduling improvement.

The API exposes tenant-scoped analytics reads through protected endpoints:

- `GET /api/tenants/:tenantSlug/analytics/overview`
- `GET /api/tenants/:tenantSlug/analytics/daily-rollups?from=YYYY-MM-DD&to=YYYY-MM-DD`

Both endpoints require `analytics:read`, resolved membership, and `RequestContext`. Owner and admin roles receive `analytics:read` by default; agent and viewer roles do not. Daily rollup reads validate UTC date inputs, cap the requested range at 90 days, and do not calculate missing rollups synchronously in the request path.

## Performance Goals

The initial documented benchmark uses 50k simulated tickets and 250k comments. k6 load tests must report p50, p95, and p99 latencies for selected read and write endpoints.

The target is p95 under 150ms for indexed read endpoints under the documented benchmark conditions. Query plans and indexes must be reviewed for tenant-scoped ticket lists, assignee queues, priority queues, SLA checks, audit logs, and search.
