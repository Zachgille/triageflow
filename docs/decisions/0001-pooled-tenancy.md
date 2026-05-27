# ADR 0001: Pooled Tenancy

## Context

TriageFlow must support multiple customer tenants while keeping the initial system operationally simple. The application needs strong tenant isolation, efficient tenant-scoped queries, and predictable local development.

## Decision

Use pooled tenancy in shared PostgreSQL tables. Every tenant-owned table must include `tenant_id`, and every tenant-owned query must be scoped by `tenant_id`.

Tenant isolation is enforced in backend repositories, services, authorization checks, integration tests, and supporting indexes.

## Alternatives Considered

- Database per tenant: stronger physical isolation, but operationally expensive for an early production-style system.
- Schema per tenant: clearer separation than pooled rows, but adds migration and connection complexity.
- Pooled tenancy without strict repository rules: simpler initially, but too risky for cross-tenant leaks.

## Consequences

Pooled tenancy keeps deployment and migrations simpler. It requires disciplined query scoping, tenant-aware indexes, and comprehensive cross-tenant denial tests. A single missing `tenant_id` filter can become a critical security issue.
