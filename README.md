# TriageFlow

TriageFlow is a production-style multi-tenant support desk SaaS.

The planned stack is:

- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- API: NestJS, Fastify, TypeScript
- Database: PostgreSQL, Prisma
- Background jobs: Redis, BullMQ
- Authentication: Clerk for identity only
- CI: GitHub Actions
- Local development: Docker Compose
- Load testing: k6

This repository currently contains the monorepo scaffold, identity/RBAC database foundation, Clerk authentication integration, authenticated profile/workspace onboarding, ticket/comment APIs, audit logging, SLA and analytics workers, protected analytics APIs, a minimal frontend analytics dashboard, cursor pagination, and local k6 benchmark harnesses.

## System Goals

TriageFlow must support pooled multi-tenancy with `tenant_id` on every tenant-owned table and tenant-scoped data access throughout the backend. Authorization is enforced by the backend through users, tenants, memberships, roles, permissions, and role permissions.

The core ticket workflow is:

```text
new -> open -> pending_customer
          \-> pending_internal
          \-> resolved -> closed
```

Tickets support public comments and internal notes. Internal notes must never be exposed to users without the required permission.

Important business mutations must write audit logs transactionally where practical. Background processing uses Redis and BullMQ for SLA checks, SLA breach detection, notifications, and analytics rollups. Worker behavior must be idempotent.

## Performance Target

The benchmark target is p95 under 150ms for indexed read endpoints under documented benchmark conditions using:

- 50k simulated tickets
- 250k simulated comments
- k6 load tests
- PostgreSQL indexes for tenant-scoped ticket lists, queues, SLA checks, audit logs, and search

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for benchmark methodology.

## Documentation Map

- [AGENTS.md](AGENTS.md): instructions for future coding agents
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): high-level architecture and constraints
- [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md): strict implementation rules
- [docs/SECURITY.md](docs/SECURITY.md): threat model and security requirements
- [docs/ENV_SETUP.md](docs/ENV_SETUP.md): local environment and Clerk key setup
- [docs/LOCAL_AUTH_SMOKE_TEST.md](docs/LOCAL_AUTH_SMOKE_TEST.md): manual real-auth smoke test checklist
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md): required testing strategy
- [docs/PERFORMANCE.md](docs/PERFORMANCE.md): benchmark contract and current local baseline
- [docs/benchmarks/2026-05-27-local-baseline.md](docs/benchmarks/2026-05-27-local-baseline.md): dated local k6 baseline
- [docs/benchmarks/2026-05-27-query-plans.md](docs/benchmarks/2026-05-27-query-plans.md): dated query-plan evidence
- [docs/IMPLEMENTATION_STATE.md](docs/IMPLEMENTATION_STATE.md): current implementation status
- [docs/decisions](docs/decisions): architectural decision records

## Setup

For the full Windows PowerShell setup flow, see [docs/LOCAL_DEV.md](docs/LOCAL_DEV.md). For Clerk and `.env` setup, see [docs/ENV_SETUP.md](docs/ENV_SETUP.md). For real-auth verification, see [docs/LOCAL_AUTH_SMOKE_TEST.md](docs/LOCAL_AUTH_SMOKE_TEST.md).

Install dependencies:

```bash
corepack pnpm install
```

Start local infrastructure:

```bash
corepack pnpm infra:up
```

Prepare local database:

```bash
Copy-Item .env.example .env
corepack pnpm db:migrate
corepack pnpm db:generate
corepack pnpm db:seed
```

Configure Clerk for authenticated local UI/API calls:

```bash
# set real values in .env
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_AUTHORIZED_PARTIES="http://localhost:3000"
```

After Clerk is configured, open `http://localhost:3000/onboarding` to sign in, complete the internal profile bootstrap, create a first workspace, and enter that workspace ticket queue.

Check local environment values without printing secrets:

```bash
corepack pnpm env:doctor
```

Check local API/web reachability after both dev servers are running:

```bash
corepack pnpm smoke:local
```

Optional benchmark dataset and k6 harness:

```bash
corepack pnpm db:seed:large
corepack pnpm db:bench:counts
corepack pnpm bench:k6:tickets
corepack pnpm bench:k6:comments
corepack pnpm bench:k6:mixed
```

Benchmark runs use the development bearer-token fallback and require the API to run with `NODE_ENV=development` and `CLERK_DEV_BEARER_AUTH=true`. See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) before publishing any benchmark claims.

Run validation:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm --filter @triageflow/web test
```

Run development processes:

```bash
corepack pnpm --filter @triageflow/web dev
corepack pnpm --filter @triageflow/api dev
corepack pnpm --filter @triageflow/worker dev
```

## Non-Negotiable Rules

1. Controllers must never call Prisma directly.
2. Every tenant-owned table must include `tenant_id`.
3. Every tenant-owned query must be scoped by `tenant_id`.
4. Every protected endpoint requires auth, tenant resolution, membership check, and permission check.
5. Frontend authorization is cosmetic only; backend authorization is authoritative.
6. Every important business mutation writes an audit log in the same database transaction where practical.
7. Background jobs must be idempotent.
8. All schema changes require migrations.
9. Applied migrations must never be edited.
10. No new endpoint without integration tests.
11. No raw SQL without an index/query-plan rationale.
12. No broad refactors without tests passing first.
13. Main branch must always remain deployable.
