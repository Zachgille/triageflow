# Project Rules

These rules are strict implementation constraints for TriageFlow.

## Repository And Workflow

1. Main branch must always remain deployable.
2. Future work should be delivered as small vertical slices.
3. A slice should include schema, backend behavior, authorization, tests, and documentation updates when applicable.
4. Do not perform broad refactors unless the relevant tests pass first.
5. Update `docs/IMPLEMENTATION_STATE.md` after meaningful changes.

## Backend Boundaries

1. Controllers must never call Prisma directly.
2. Controllers may validate transport concerns and delegate to services.
3. Services own business workflows and authorization orchestration.
4. Repositories own data access.
5. Tenant-owned repositories must require `RequestContext`.
6. Background workers must not bypass repository tenancy rules.

## Tenancy

1. Every tenant-owned table must include `tenant_id`.
2. Every tenant-owned query must be scoped by `tenant_id`.
3. Every tenant-scoped index must account for `tenant_id`.
4. Cross-tenant reads and writes must fail closed.
5. Tests must cover cross-tenant access denial for every tenant-owned feature.

## Authorization

1. Clerk is authentication only.
2. Application RBAC is implemented in the database.
3. Every protected endpoint requires auth, tenant resolution, membership check, and permission check.
4. Frontend authorization is cosmetic only.
5. Backend authorization is authoritative.
6. Internal notes require explicit read and write permissions.
7. Object-level authorization must be enforced on every tenant-owned object.

## Database And Migrations

1. All schema changes require migrations.
2. Applied migrations must never be edited.
3. Raw SQL requires a written index/query-plan rationale.
4. Tenant-scoped list queries must have supporting indexes.
5. Unique constraints must be used for idempotency where duplicated work would create incorrect state.

## Audit Logging

1. Important business mutations must write audit logs.
2. Audit logs should be written in the same database transaction as the mutation where practical.
3. Audit records must be tenant-scoped.
4. Audit records must include enough context to reconstruct who changed what and when.

## Background Jobs

1. BullMQ jobs must be idempotent.
2. Job handlers must tolerate retries and duplicate delivery.
3. Job payloads must include enough tenant and entity identity to scope work safely.
4. Workers must not expose data across tenants.
5. SLA breach and notification jobs must prevent duplicate side effects.

## Testing

1. No new endpoint without integration tests.
2. Integration tests must include auth, membership, permission, and tenant isolation cases.
3. RBAC tests must cover allowed and denied actions.
4. Security-sensitive features must include negative tests.
5. Load-sensitive endpoints must be represented in benchmark coverage.

## CI

CI must eventually run:

- lint
- typecheck
- unit tests
- integration tests
- E2E tests where applicable
- Prisma migration checks
- application builds
- Docker build
- k6 load tests when configured for benchmark runs
