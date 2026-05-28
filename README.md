# TriageFlow

TriageFlow is a production-style multi-tenant support desk SaaS built to demonstrate backend-heavy full-stack engineering: tenant isolation, application RBAC, audited workflows, workers, analytics, and measured performance.

It models the core of a support platform where multiple workspaces can manage tickets, public customer replies, internal notes, SLA breach checks, and operational analytics without leaking data across tenants.

## What It Includes

- Multi-tenant data model with `tenant_id` on tenant-owned tables.
- Clerk authentication for identity, with application-owned users, memberships, roles, and permissions for authorization.
- Backend-enforced RBAC using tenant-scoped `RequestContext`.
- Ticket queue, ticket detail, ticket creation, status transitions, assignment, public comments, and internal notes.
- Transactional audit logging for important ticket/comment mutations.
- SLA policies, synchronous SLA satisfaction timestamps, idempotent BullMQ SLA breach workers, and repeatable worker scheduling.
- Analytics daily rollups, analytics worker jobs, protected analytics API endpoints, and a minimal permission-aware analytics dashboard.
- Opaque cursor pagination for ticket and comment lists.
- Deterministic large seed data and k6 benchmark harness.
- Live PostgreSQL API integration tests for tenant isolation, RBAC, pagination, audit, and transactional behavior.

## Architecture

TriageFlow is a modular monolith with a separate worker process:

- `apps/web`: Next.js frontend
- `apps/api`: NestJS + Fastify API
- `apps/worker`: BullMQ worker process
- `packages/db`: Prisma schema/client package
- `packages/config`: shared runtime config validation
- `packages/shared`: shared TypeScript types
- `infra`: Docker Compose and k6 scripts

The API owns authorization and business rules. Controllers do not call Prisma directly; tenant-owned data access goes through repositories/services that receive `RequestContext`. Workers reuse tenant-scoped data-access rules and rely on database uniqueness for idempotency.

## Tech Stack

- Next.js, TypeScript, Tailwind CSS, shadcn/ui-ready components
- NestJS, Fastify, TypeScript
- PostgreSQL, Prisma
- Redis, BullMQ
- Clerk
- Vitest, React Testing Library
- Docker Compose
- k6

## Local Setup

Windows PowerShell from the repository root:

```powershell
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm db:generate
corepack pnpm db:seed
```

For real Clerk auth, set these in `.env`:

```powershell
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_AUTHORIZED_PARTIES="http://localhost:3000"
```

Run the apps:

```powershell
corepack pnpm --filter @triageflow/api dev
corepack pnpm --filter @triageflow/web dev
corepack pnpm --filter @triageflow/worker dev
```

Open `http://localhost:3000/onboarding` to sign in, complete profile bootstrap, create a workspace, and enter the ticket queue.

## Validation

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
corepack pnpm test:integration
corepack pnpm db:validate
corepack pnpm db:generate
```

The live API integration suite uses `TEST_DATABASE_URL` and a dedicated `triageflow_test` database. It applies migrations, seeds minimal test data, and uses a test auth provider rather than real Clerk sessions.

## Benchmarks

TriageFlow includes an opt-in deterministic benchmark seed:

- 10 tenants
- 500 users
- 50,000 tickets
- 250,000 comments
- 500,000 audit logs
- SLA breaches and analytics rollups

Full local k6 baseline, 20 VUs for 5 minutes, met the p95 under 150ms target for measured indexed read endpoints. A query-plan-driven index optimization changed unfiltered ticket queue reads from sequential scan + top-N sort to an index scan and reduced `ticket_list` p95 from `42.00ms` to `17.59ms` under documented local conditions.

Benchmark commands:

```powershell
corepack pnpm db:seed:large
corepack pnpm db:bench:counts
corepack pnpm bench:k6:tickets
corepack pnpm bench:k6:comments
corepack pnpm bench:k6:mixed
```

Benchmark auth uses the local development bearer fallback only with `NODE_ENV=development` and `CLERK_DEV_BEARER_AUTH=true`. Do not enable it in production.

## Security Model

Frontend permission hiding is cosmetic. The backend enforces auth, tenant resolution, membership checks, and permission checks for protected routes. Cross-tenant object access is denied through tenant-scoped repositories and composite database relations. Internal notes are returned only to users with internal-note permission.

## Documentation

- [docs/README.md](docs/README.md): documentation index
- [docs/ARCHITECTURE_SUMMARY.md](docs/ARCHITECTURE_SUMMARY.md): interview-oriented architecture summary
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md): 3-5 minute walkthrough script
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md): benchmark methodology and results
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md): test strategy
- [docs/SECURITY.md](docs/SECURITY.md): threat model
- [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md): local setup
- [docs/RESUME_BULLETS.md](docs/RESUME_BULLETS.md): measured resume/interview phrasing
- [docs/REPO_HYGIENE.md](docs/REPO_HYGIENE.md): publication checklist
