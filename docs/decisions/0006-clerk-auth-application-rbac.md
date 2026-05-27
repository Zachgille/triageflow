# ADR 0006: Clerk Authentication And Application RBAC

## Context

TriageFlow needs reliable user authentication and application-specific authorization across tenants. Authentication identity and support-desk permissions are separate concerns.

## Decision

Use Clerk for authentication only. Store application authorization in TriageFlow using users, tenants, memberships, roles, permissions, and role permissions.

Every protected endpoint must authenticate the user, resolve the tenant, validate membership, resolve permissions, and check the required permission.

## Alternatives Considered

- Store all authorization in Clerk metadata: convenient initially, but less suitable for transactional RBAC, auditing, and tenant-specific permission changes.
- Build authentication from scratch: maximum control, but unnecessary risk and effort.
- Use frontend-only authorization: unacceptable because frontend checks are cosmetic and bypassable.

## Consequences

Authentication is delegated to Clerk while authorization remains under application control. The backend must consistently enforce RBAC and audit membership, role, and permission changes.
