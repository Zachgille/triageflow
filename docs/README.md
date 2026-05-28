# Documentation Index

Use this page as the starting point for reviewing TriageFlow without reading every implementation file.

## Reviewer Guides

- [ARCHITECTURE_SUMMARY.md](ARCHITECTURE_SUMMARY.md): high-signal architecture decisions and tradeoffs.
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md): 3-5 minute walkthrough for portfolio videos, recruiter screens, or interviews.
- [RESUME_BULLETS.md](RESUME_BULLETS.md): measured resume bullets and interview talking points.
- [REPO_HYGIENE.md](REPO_HYGIENE.md): checklist before publishing or sharing the repository.

## Technical Contract

- [ARCHITECTURE.md](ARCHITECTURE.md): system architecture, boundaries, tenancy, RBAC, audit, workers, analytics, and performance goals.
- [PROJECT_RULES.md](PROJECT_RULES.md): implementation rules future work must follow.
- [SECURITY.md](SECURITY.md): threat model for tenant isolation, authorization, internal notes, secrets, and abuse controls.
- [TEST_PLAN.md](TEST_PLAN.md): required unit, integration, live DB, frontend, security, and load test coverage.
- [PERFORMANCE.md](PERFORMANCE.md): benchmark methodology, current local baseline, index optimization, and claim boundaries.

## Local Operation

- [LOCAL_DEV.md](LOCAL_DEV.md): Windows PowerShell setup, Docker services, database, worker, benchmark, and integration test commands.
- [ENV_SETUP.md](ENV_SETUP.md): `.env` setup, Clerk keys, public vs secret variables, and environment checks.
- [LOCAL_AUTH_SMOKE_TEST.md](LOCAL_AUTH_SMOKE_TEST.md): manual real-Clerk sign-in/onboarding smoke checklist.

## Benchmark Evidence

- [QUERY_PLANS.md](QUERY_PLANS.md): copy-paste SQL for hot query plan inspection.
- [benchmarks/2026-05-27-local-baseline.md](benchmarks/2026-05-27-local-baseline.md): full local k6 baseline.
- [benchmarks/2026-05-27-query-plans.md](benchmarks/2026-05-27-query-plans.md): baseline query-plan evidence.
- [benchmarks/2026-05-27-index-optimization.md](benchmarks/2026-05-27-index-optimization.md): tenant/order ticket index evaluation and result.
- [BENCHMARK_REPORT_TEMPLATE.md](BENCHMARK_REPORT_TEMPLATE.md): template for future benchmark reports.

## Project Memory

- [IMPLEMENTATION_STATE.md](IMPLEMENTATION_STATE.md): current implementation status, commands run, known limitations, and next recommended work.
- [decisions](decisions): architecture decision records.
