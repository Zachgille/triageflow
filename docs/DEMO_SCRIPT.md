# Demo Script

This is a 3-5 minute walkthrough for a recruiter screen, interview, or portfolio video.

## 1. Open With The Problem

"TriageFlow is a multi-tenant support desk SaaS. The core engineering problem is keeping tenant data isolated while supporting real support workflows: tickets, public replies, internal notes, RBAC, audit logs, SLA checks, analytics, and performance benchmarks."

## 2. Sign In And Onboard

1. Open `http://localhost:3000/onboarding`.
2. Show Clerk sign-in or the signed-in state.
3. Complete profile bootstrap if the internal user does not exist.
4. Create a workspace if the user has no memberships.
5. Explain that Clerk proves identity only; app-owned users, memberships, roles, and permissions control authorization.

## 3. Show The Ticket Queue

1. Open `/<tenantSlug>/tickets`.
2. Point out the workspace header, current user, role, workspace switcher, and navigation.
3. Show ticket list filters and cursor pagination with "Load more".
4. Explain that the backend enforces `ticket:read`; frontend permission hiding is cosmetic.

## 4. Create And Work A Ticket

1. Open `/<tenantSlug>/tickets/new`.
2. Create a ticket with requester, subject, description, and priority.
3. Explain that ticket creation looks up tenant-scoped SLA policy and writes `ticket.created` audit log transactionally.
4. Open the ticket detail page.
5. Change status or assignment if the current role has permission.

## 5. Comments And Internal Notes

1. Add a public comment.
2. Add an internal note as an authorized user.
3. Explain:
   - Public internal-user comment sets `first_responded_at` once.
   - Internal notes do not satisfy first response.
   - Users without internal-note permission do not receive internal notes from the API.

## 6. Analytics And Workers

1. Open `/<tenantSlug>/analytics` as an owner/admin.
2. Show operational overview cards and daily rollup table.
3. Explain that analytics reads use protected API endpoints requiring `analytics:read`.
4. Mention BullMQ workers:
   - SLA breach worker records idempotent breaches.
   - Analytics worker calculates tenant/date rollups.
   - Repeatable scheduling is conservative and documented.

## 7. Evidence For Engineering Quality

Show docs rather than implementation files:

1. [PERFORMANCE.md](PERFORMANCE.md): benchmark methodology and results.
2. [benchmarks/2026-05-27-index-optimization.md](benchmarks/2026-05-27-index-optimization.md): query-plan-driven index optimization.
3. [TEST_PLAN.md](TEST_PLAN.md): test strategy.
4. Run or show:

```powershell
corepack pnpm test:integration
```

Explain that live PostgreSQL integration tests prove tenant isolation, RBAC, cursor pagination, audit writes, and transaction rollback against a real database.

## 8. Close

"The project is not claiming production usage. The measured claim is: seeded 50k tickets and 250k comments, benchmarked indexed read endpoints with k6 under documented local conditions, and verified critical tenant/RBAC paths against live PostgreSQL."
