# ADR 0005: PostgreSQL Indexing

## Context

TriageFlow targets p95 under 150ms for indexed read endpoints under a benchmark with 50k tickets and 250k comments. Tenant-scoped support desk workflows rely heavily on lists, queues, SLA checks, audit logs, and search.

## Decision

Use PostgreSQL indexes designed around documented access patterns. Tenant-scoped indexes must include `tenant_id` and support:

- ticket lists
- assignee queues
- priority queues
- SLA checks
- audit logs
- search

Indexes should be validated with query plans and benchmark results.

## Alternatives Considered

- Add indexes reactively only after production issues: avoids premature indexes, but risks missing the documented benchmark target.
- Index every plausible filter: can slow writes and increase storage without evidence.
- Use external search immediately: adds operational complexity before core relational search paths are proven insufficient.

## Consequences

The schema must balance read performance with write cost. Indexes need explicit rationale tied to queries and benchmark evidence. Raw SQL requires index/query-plan justification.
