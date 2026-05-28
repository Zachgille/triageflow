# Resume Bullets

Use measured, defensible claims only.

## Short Bullets

- Built TriageFlow, a multi-tenant support desk SaaS with Next.js, NestJS/Fastify, PostgreSQL/Prisma, Redis/BullMQ, Clerk auth, tenant RBAC, audit logs, SLA workers, and analytics rollups.
- Seeded 50k tickets and 250k comments, then benchmarked indexed read endpoints with k6 under documented local conditions.
- Reduced unfiltered ticket-list p95 from 42.0ms to 17.6ms with a query-plan-driven PostgreSQL composite index.

## Backend-Focused Bullets

- Designed tenant-scoped data access using `RequestContext`, application-owned RBAC, composite tenant relations, and live PostgreSQL integration tests for cross-tenant denial.
- Implemented transactional audit logging for ticket/comment mutations and verified rollback behavior for failed SLA-policy ticket creation.
- Built idempotent BullMQ workers for SLA breach checks and analytics daily rollups with repeatable scheduling, bounded batch behavior, and queue observability.

## Full-Stack Bullets

- Built authenticated workspace onboarding, ticket workflows, permission-aware UI controls, comment/internal-note timelines, and analytics dashboard backed by protected APIs.
- Integrated Clerk for identity while preserving backend-authoritative application RBAC and tenant-specific memberships.
- Added Vitest/React Testing Library coverage for authenticated shell states, permission-aware ticket UI, and analytics dashboard states.

## Interview Talking Points

- Tenant isolation: every tenant-owned table has `tenant_id`, repositories require `RequestContext`, and live DB tests prove cross-tenant denial.
- Performance: benchmark claims are tied to seed shape, k6 configuration, query plans, and a documented before/after index optimization.
- Reliability: important mutations use transactions and audit logs; background jobs are idempotent through unique constraints and bounded processing.

## Do Not Overclaim

Do not claim:

- enterprise scale
- production proven
- millions of users
- real customers
- deployed usage
- cloud-scale reliability

Allowed wording:

- "Production-style architecture."
- "Benchmarked locally under documented conditions."
- "Seeded 50k tickets and 250k comments."
- "Live PostgreSQL integration tests cover critical tenant/RBAC/pagination/transaction paths."
