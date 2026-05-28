# Repo Hygiene

Use this checklist before publishing, sharing, or recording a portfolio walkthrough.

## Required Before Sharing

- `.env` is not committed.
- `.env.example` contains placeholders only.
- Clerk secret keys are never committed.
- `CLERK_DEV_BEARER_AUTH` is documented as local development only and ignored outside development.
- Benchmark raw JSON outputs under `benchmark-results/local` are ignored.
- Generated output is ignored: `node_modules`, `.next`, `dist`, `.prisma`, coverage, logs, and TypeScript build info.
- Prisma migrations are committed.
- Documentation is committed.
- Benchmark reports are committed.
- `docs/IMPLEMENTATION_STATE.md` is current.

## Validation Checklist

Run:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
corepack pnpm test:integration
corepack pnpm db:validate
corepack pnpm db:generate
```

If `db:generate` fails on Windows with `query_engine-windows.dll.node` locked, stop API/web/worker Node processes and rerun it.

## Optional Portfolio Assets

- Screenshot of onboarding.
- Screenshot of ticket queue.
- Screenshot of ticket detail with comments/internal notes.
- Screenshot of analytics dashboard.
- Short terminal clip showing `corepack pnpm test:integration`.
- Short terminal clip showing benchmark report or k6 summary.

## GitHub Repo Suggestions

Description:

```text
Production-style multi-tenant support desk SaaS with NestJS, Next.js, PostgreSQL, BullMQ workers, RBAC, audit logs, analytics, and documented k6 benchmarks.
```

Topics:

```text
nextjs nestjs typescript postgresql prisma redis bullmq clerk multi-tenant rbac k6 saas
```

Suggested first release/tag:

```text
v0.1.0-portfolio-baseline
```

Release notes should mention:

- tenant/RBAC core
- ticket/comment workflows
- audit and SLA workers
- analytics dashboard
- cursor pagination
- 50k/250k benchmark seed and documented k6 baseline
- live PostgreSQL integration harness
