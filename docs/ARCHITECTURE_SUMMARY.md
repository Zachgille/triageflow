# Architecture Summary

This page summarizes the architectural choices that matter most in an interview.

## Pooled Tenancy

Tenant-owned tables include `tenant_id`. This supports one shared PostgreSQL database while keeping every tenant-owned query scoped by tenant. Composite foreign keys such as tenant/ticket and tenant/requester make cross-tenant object references harder to create accidentally.

Tradeoff: pooled tenancy requires discipline in every data-access path. TriageFlow enforces that through repository rules, RequestContext, integration tests, and documentation.

## Clerk Identity, Application RBAC

Clerk handles authentication only. TriageFlow maps Clerk provider user ids to internal `User` rows, then derives access from `Tenant`, `Membership`, `Role`, `Permission`, and `RolePermission`.

Reason: a user can have different roles in different tenants, and authorization must be controlled by application data rather than frontend state or identity-provider metadata alone.

## RequestContext In Repositories

Protected requests resolve a `RequestContext` containing `requestId`, `userId`, `tenantId`, `membershipId`, and `permissions`. Tenant-owned repository methods require this context and scope queries by `ctx.tenantId`.

Reason: this makes tenant scoping a normal part of the backend API rather than an optional filter passed from controllers.

## Transactional Audit Logs

Important ticket and comment mutations write audit logs in the same Prisma transaction where practical.

Reason: an audit trail is only useful if it reflects committed business changes. Missing-SLA integration tests verify that failed ticket creation does not leave partial ticket or audit rows.

## Worker Boundary

The API handles request/response business behavior. The worker process handles background jobs through Redis/BullMQ.

Current workers:

- SLA breach checks
- Analytics daily rollup execution
- Conservative repeatable scheduling and queue status tooling

Reason: SLA checks and analytics rollups are retryable, bounded background work. Database uniqueness makes duplicate SLA breach jobs safe to retry.

## Analytics Rollups

Analytics uses `AnalyticsDailyRollup` rows per tenant/date rather than calculating every dashboard metric from hot ticket/comment tables at request time.

Reason: rollups keep dashboard reads predictable and create a future path for scheduled aggregation without changing the frontend API contract.

Tradeoff: daily rollups are UTC-only for now. Tenant timezone calendars are a future improvement.

## Cursor Pagination

Ticket lists use opaque cursors backed by `createdAt` and `id`, ordered by `created_at DESC, id DESC`. Comment timelines use the same cursor shape with `created_at ASC, id ASC`.

Reason: `id` is a stable tie-breaker when many rows share the same timestamp. The cursor does not include tenant id; tenant scope still comes only from `RequestContext`.

## Benchmark-Driven Index

The unfiltered ticket queue originally met the latency target but used sequential scan + top-N sort. Query-plan evidence justified one targeted index:

```text
tickets_tenant_id_created_at_id_desc_idx
tenant_id, created_at DESC, id DESC
```

Result: direct query plans changed to index scans, and focused k6 `ticket_list` p95 improved from `42.00ms` to `17.59ms` under documented local conditions.

Tradeoff: the extra index adds write amplification and disk usage. It is kept because it directly matches a measured hot route.

## Future Improvements

- Cursor-based tenant enumeration for analytics scheduler coverage beyond first N tenants.
- Tenant timezone-aware analytics and business-hour SLA calendars.
- SLA/analytics operational dashboard for worker visibility.
- More browser-level end-to-end tests around real Clerk sessions.
- Deployment hardening and secret management for a real hosted environment.
