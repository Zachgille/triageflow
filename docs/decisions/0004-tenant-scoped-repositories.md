# ADR 0004: Tenant-Scoped Repositories

## Context

Pooled tenancy makes tenant scoping mandatory for every tenant-owned data access path. Controllers and services need a consistent way to pass request identity, tenant identity, membership, and permissions to data access.

## Decision

Every tenant-scoped repository method receives `RequestContext` containing `requestId`, `userId`, `tenantId`, `membershipId`, and `permissions`.

Controllers must never call Prisma directly. Repositories own Prisma access and apply tenant scoping for tenant-owned data.

## Alternatives Considered

- Pass `tenantId` as a separate argument only: simpler, but loses request and authorization context needed for auditing and policy checks.
- Use global async context only: convenient, but can hide dependencies and make tests less explicit.
- Allow controllers to call Prisma: faster for prototypes, but violates layering and increases tenant leak risk.

## Consequences

Repository signatures are more explicit and slightly more verbose. The benefit is a consistent security boundary, better testability, and easier audit logging.
