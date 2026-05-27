# Security

This document defines the baseline threat model and security requirements for TriageFlow.

## Security Boundaries

- Clerk authenticates identities.
- TriageFlow authorizes application actions.
- PostgreSQL stores tenant-owned data in pooled tables isolated by `tenant_id`.
- The backend API is the authoritative authorization boundary.
- The frontend must never be treated as a security boundary.
- `GET /api/me` and `/api/onboarding/*` are authenticated onboarding/profile routes. They are intentionally not tenant-scoped because they discover or create the first tenant, and they must not grant access to existing tenants.
- Frontend workspace context and permission-aware controls are usability features only. Users can still send arbitrary requests, so every protected backend route must keep enforcing membership and permission checks.

## Threat Model

### Cross-Tenant Data Leaks

Risk: a user from one tenant reads or mutates data owned by another tenant.

Controls:

- Require `tenant_id` on every tenant-owned table.
- Require `tenant_id` filters on every tenant-owned query.
- Require `RequestContext` in tenant-scoped repositories.
- Add cross-tenant denial integration tests for every tenant-owned feature.
- Use tenant-aware indexes for common access paths.

### Privilege Escalation

Risk: a user gains permissions beyond their role or membership.

Controls:

- Treat Clerk as authentication only.
- Verify Clerk session tokens on the API before creating auth context.
- Resolve permissions from application memberships, roles, permissions, and role permissions.
- Check permissions on every protected endpoint.
- Prevent users from assigning roles or permissions they are not allowed to manage.
- Audit role, membership, and permission changes.
- Onboarding profile bootstrap may create only the current Clerk user's internal `User` row.
- First-workspace creation may create only a new tenant and an owner membership for the current internal user. It must reject duplicate tenant slugs and must not grant access to preexisting tenants.

### Broken Object-Level Authorization

Risk: a user can access a valid object id without permission for that tenant or object.

Controls:

- Scope object lookup by `tenant_id`.
- Validate membership before object access.
- Check action-specific permissions.
- Avoid fetching by global id alone for tenant-owned objects.
- Treat audit logs as tenant-owned data and scope all audit log reads by `tenant_id`.
- For tenant-scoped route context, missing authentication returns `401`, missing application user or tenant membership returns `403`, and an unknown tenant slug returns `404`.
- Future tenant-owned object lookups must return `404` for cross-tenant object ids so object existence is not leaked across tenants.

### Internal Note Exposure

Risk: internal notes are exposed through ticket detail, comment lists, search, exports, notifications, or analytics.

Controls:

- Store internal notes with explicit visibility metadata.
- Require permission checks for reading and writing internal notes.
- Filter internal notes out of unauthorized responses at the backend.
- Add tests for every endpoint that can return ticket conversation data.

### Mass Assignment

Risk: clients set fields they should not control, such as `tenant_id`, `user_id`, `role`, audit fields, internal visibility, or SLA status.

Controls:

- Use explicit DTOs.
- Never spread request bodies directly into persistence calls.
- Derive sensitive fields from `RequestContext` or server-side state.
- Validate allowed state transitions in services.
- Derive audit `tenant_id`, actor, and request id from trusted server-side context, not request bodies.

### SQL Injection

Risk: unsafe raw SQL or query construction allows injection.

Controls:

- Prefer Prisma query APIs.
- Require written rationale for raw SQL.
- Parameterize all raw SQL.
- Include index and query-plan rationale for raw SQL.
- Review raw SQL in code review.

### Missing Auth Guards

Risk: protected endpoints are accidentally exposed.

Controls:

- Default endpoints to protected unless explicitly public.
- Require auth, tenant resolution, membership check, and permission check.
- Treat authenticated onboarding/profile endpoints as explicit exceptions to tenant resolution; they still require Clerk authentication and must not read or mutate tenant-owned domain data outside the new workspace transaction.
- Keep development auth shortcuts disabled by default and unavailable outside `NODE_ENV=development`.
- Keep temporary debug endpoints unavailable in production.
- Add integration tests for unauthenticated and unauthorized requests.
- Keep public routes minimal and documented.

### Secret Leakage

Risk: secrets leak through source control, logs, CI, client bundles, or error responses.

Controls:

- Never commit secrets.
- Use environment variables and secret managers for deployment.
- Do not expose server-only secrets to Next.js public environment variables.
- Expose only Clerk publishable keys through `NEXT_PUBLIC_*`; never expose `CLERK_SECRET_KEY` or `CLERK_JWT_KEY` to the frontend.
- Treat `.env` as local secret material. Keep `.env.example` placeholder-only and commit-safe.
- Run `corepack pnpm env:doctor` locally to catch missing keys, placeholder Clerk keys, accidental `NEXT_PUBLIC_*` secret exposure, and unsafe `CLERK_DEV_BEARER_AUTH` defaults.
- Redact secrets from logs.
- Avoid returning raw exception details in production responses.
- Do not store secrets, credentials, bearer tokens, session tokens, or full provider payloads in audit `before`, `after`, or `metadata` fields.

### Abuse And Rate Limiting

Risk: excessive requests, brute force attempts, scraping, or expensive queries degrade service or expose data.

Controls:

- Add rate limiting for authentication-adjacent and high-cost endpoints.
- Use pagination limits.
- Use indexed query paths for list endpoints.
- Monitor high error rates and unusual access patterns.
- Apply worker concurrency limits and retry policies.

## Required Security Tests

- Unauthenticated requests are denied.
- Invalid Clerk tokens are denied.
- Authenticated users without tenant membership are denied.
- Tenant members without required permission are denied.
- Cross-tenant object access is denied.
- Internal notes are not returned to unauthorized users.
- Mass assignment attempts cannot override protected fields.
- RBAC changes are audited.
