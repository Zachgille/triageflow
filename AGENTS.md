# AGENTS.md

This repository has a monorepo foundation scaffold. Do not implement auth, tickets, RBAC, tenant-owned database schema, or production domain workflows unless the task explicitly asks for that phase.

## Setup Commands

```bash
# install dependencies
corepack pnpm install

# start local infrastructure
corepack pnpm infra:up

# run database migrations after schema exists
corepack pnpm db:migrate

# generate Prisma Client
corepack pnpm db:generate

# validate Prisma schema
corepack pnpm db:validate

# seed local demo RBAC data
corepack pnpm db:seed

# reset local database if needed
corepack pnpm db:reset

# start web, API, and worker processes
corepack pnpm --filter @triageflow/web dev
corepack pnpm --filter @triageflow/api dev
corepack pnpm --filter @triageflow/worker dev
```

## Testing And Linting Commands

```bash
# lint
corepack pnpm lint

# typecheck
corepack pnpm typecheck

# build
corepack pnpm build

# tests
corepack pnpm test

# API guard tests
corepack pnpm --filter @triageflow/api test

# e2e tests, once configured
# TODO: pnpm test:e2e

# Prisma migration checks, once schema exists
# TODO

# k6 load tests, once benchmarks exist
# TODO
```

## Coding Rules

- Controllers must never call Prisma directly.
- Data access must go through tenant-scoped repositories or approved service abstractions.
- Every tenant-owned table must include `tenant_id`.
- Every tenant-owned query must be scoped by `tenant_id`.
- Every protected endpoint must perform auth, tenant resolution, membership validation, and permission checks.
- Frontend authorization is cosmetic only. Backend authorization is authoritative.
- Important business mutations must write audit logs in the same database transaction where practical.
- Background jobs must be idempotent and safe to retry.
- All schema changes require Prisma migrations.
- Applied migrations must never be edited.
- No new endpoint may be added without integration tests.
- No raw SQL may be introduced without a written index/query-plan rationale.
- Do not perform broad refactors unless the relevant test suite is passing first.
- Keep main deployable.

## Architecture Constraints

TriageFlow is a modular monolith with a separate worker process, not a microservices system. The planned runtime boundaries are:

- `web`: Next.js frontend
- `api`: NestJS + Fastify API
- `worker`: BullMQ worker process
- `postgres`: durable relational data store
- `redis`: queues, scheduled jobs, and ephemeral coordination

The API owns business rules and authorization. The worker owns background processing but must reuse the same domain rules and tenant-scoped data-access constraints.

Each protected request must resolve a `RequestContext` containing:

- `requestId`
- `userId`
- `tenantId`
- `membershipId`
- `permissions`

Every tenant-scoped repository method must receive `RequestContext`.

## Documentation Maintenance

After every meaningful implementation change, update [docs/IMPLEMENTATION_STATE.md](docs/IMPLEMENTATION_STATE.md). Record what changed, what is complete, what remains, and any known risks.

Future Codex tasks should be small vertical slices. A good slice includes schema, API behavior, authorization, tests, and documentation updates for one narrow capability.
