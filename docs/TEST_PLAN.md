# Test Plan

TriageFlow requires tests at unit, integration, E2E, security, and load levels.

## Unit Tests

Unit tests should cover isolated business logic without requiring external services.

Required coverage:

- ticket state transition rules
- permission resolution helpers
- SLA deadline calculations
- SLA deadline assignment during ticket creation
- SLA satisfaction timestamp lifecycle for first response, resolution, close, and reopen behavior
- SLA satisfaction and breach detection rules
- SLA breach worker batch processing and idempotency
- SLA repeatable worker scheduling and queue status reporting
- analytics daily rollup calculations, UTC boundaries, tenant scoping, and idempotent upserts
- analytics rollup worker date validation, tenant/date bounded execution, default-date behavior, and queue enqueue options
- analytics repeatable scheduler registration, disabled-by-default behavior, stable scheduler identity, custom interval validation, tenant batch-size validation, bounded tenant enumeration, deterministic tenant/date job ids, and queue status scheduler metadata
- audit metadata construction
- worker idempotency helpers
- validation utilities

## Integration Tests

Integration tests are required for every API endpoint and repository behavior that touches tenant-owned data.

Required coverage:

- auth guard behavior
- tenant resolution
- membership validation
- permission checks
- tenant-scoped repository queries
- ticket CRUD and state transitions
- ticket cursor pagination, including deterministic `created_at`/`id` ordering, filter preservation, invalid cursor rejection, and no duplicate rows across pages
- public comments
- internal notes
- comment cursor pagination, including oldest-first timeline order, internal-note visibility filtering, invalid cursor rejection, and no cross-tenant paging
- first public internal-user comment updates `first_responded_at` transactionally with comment creation
- audit log writes in business mutations
- transactional behavior for mutation plus audit log
- missing SLA policy rejection during ticket creation, including no partial ticket or audit log
- worker database side effects
- SLA policy lookup and breach creation tenancy behavior
- SLA worker tenant filters, batch limits, no-eligible-ticket behavior, and duplicate unique-constraint handling
- SLA worker stable scheduler identity, custom interval config, invalid interval rejection, retry/backoff options, and queue status command behavior
- analytics rollup repository behavior, including opened/resolved/closed counts, comment visibility counts, SLA breach counts, average duration calculations, empty-day behavior, and cross-tenant denial
- analytics rollup worker behavior, including tenant/date upsert idempotency, missing tenant rejection, invalid date rejection, no cross-tenant side effects, and queue status reporting for the analytics queue
- protected analytics endpoint behavior, including unauthenticated denial, missing membership denial, missing `analytics:read` denial, tenant-specific permission checks, overview tenant scoping, daily rollup tenant scoping, invalid date format denial, `from > to` denial, too-large range denial, and empty rollup range behavior

Every new endpoint must include integration tests before it is considered complete.

## Cross-Tenant Tests

Every tenant-owned feature must include denial tests proving:

- a user from tenant A cannot read tenant B data
- a user from tenant A cannot mutate tenant B data
- object ids cannot bypass tenant scoping
- list endpoints do not include rows from other tenants
- search endpoints do not include rows from other tenants

## RBAC Tests

RBAC tests must cover both allowed and denied actions for each permission-sensitive endpoint.

Required cases:

- authenticated user without membership is denied
- tenant member without permission is denied
- tenant member with permission is allowed
- role changes affect subsequent permission checks
- internal note permissions are enforced separately from public comment permissions

## E2E Tests

E2E tests should validate critical user workflows across the web and API once the application exists.

Initial workflow targets:

- sign in
- select tenant
- view ticket list
- create ticket
- assign ticket
- change ticket state
- add public comment
- add internal note as authorized user
- verify internal note is hidden from unauthorized user

## Frontend Component Tests

The current frontend test strategy uses Vitest, jsdom, and React Testing Library for deterministic component-level coverage of authenticated shell and permission states. These tests mock Clerk and API responses; they do not require real Clerk keys and do not replace backend authorization tests.

Current required coverage:

- signed-out onboarding/workspace shell state
- onboarding-required state for signed-in Clerk users without internal users
- no-workspace state
- active workspace shell with user, role, and permissions from `GET /api/me`
- multiple-membership workspace switcher
- invalid tenant slug or missing membership state
- viewer read-only ticket list/detail UI
- ticket list cursor loading, filter reset behavior, and no-next-page state
- comment timeline cursor loading and backend error state
- permission-gated ticket create, update, assignment, and comment/internal-note controls
- hidden internal-note UI when internal permissions are absent
- permission-gated Analytics navigation and analytics dashboard access-denied state
- analytics dashboard overview cards, daily rollup rows, empty rollup state, backend error state, and duration formatting

## Security Tests

Security tests must include:

- unauthenticated access denial
- cross-tenant access denial
- RBAC denial
- internal note exposure prevention
- mass assignment prevention
- protected field tampering prevention
- unsafe state transition denial
- audit log creation for sensitive mutations
- duplicate SLA breach prevention for idempotent future workers

## Load Tests

k6 load tests must exercise documented benchmark endpoints against seeded data.

Required reporting:

- request count
- error rate
- throughput
- p50 latency
- p95 latency
- p99 latency

Indexed read endpoints must target p95 under 150ms under the documented benchmark conditions in `docs/PERFORMANCE.md`.

Current benchmark harness coverage:

- `infra/k6/ticket-list.js` covers ticket list cursor reads, status filtering, priority filtering, optional assignee filtering, and second-page cursor reads.
- `infra/k6/comments.js` covers comment timeline cursor reads.
- `infra/k6/mixed-workload.js` covers a read-heavy operational mix across tickets, comments, analytics overview, and analytics rollups.

Large seed automation must remain opt-in and should not run during normal unit or integration tests.
