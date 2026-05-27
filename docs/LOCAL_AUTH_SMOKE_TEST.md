# Local Auth Smoke Test

This checklist verifies the real Clerk sign-in path locally. It is manual because Clerk login should not be automated without a dedicated test auth setup.

## Setup

Install dependencies:

```powershell
corepack pnpm install
```

Create and configure `.env`:

```powershell
Copy-Item .env.example .env
notepad .env
```

Set real Clerk values:

```powershell
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_AUTHORIZED_PARTIES="http://localhost:3000"
CLERK_DEV_BEARER_AUTH="false"
```

Check the local environment:

```powershell
corepack pnpm env:doctor
```

Start infrastructure and prepare the database:

```powershell
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm db:generate
corepack pnpm db:seed
```

Start the API:

```powershell
corepack pnpm --filter @triageflow/api dev
```

Start the web app in another PowerShell window:

```powershell
corepack pnpm --filter @triageflow/web dev
```

Optionally verify reachability:

```powershell
corepack pnpm smoke:local
```

## Browser Verification

1. Open `http://localhost:3000/onboarding`.
2. Verify the signed-out state shows Clerk sign-in and sign-up actions.
3. Sign in with a Clerk test user.
4. Verify the page shows the profile setup state for a new Clerk user.
5. Click `Complete profile`.
6. Verify the create-workspace form appears.
7. Create a workspace with a unique slug, such as `my-local-workspace`.
8. Verify the workspace selector or workspace card appears.
9. Open `http://localhost:3000/my-local-workspace/tickets`.
10. Verify the authenticated workspace shell shows the workspace name, current user, role, ticket queue link, and Clerk profile/sign-out controls.
11. Verify the ticket UI loads. A new workspace can show an empty queue; seeded demo tickets only exist for the seeded demo tenant.
12. Sign out and verify the same workspace URL returns to the signed-out/authentication-required state.

## API Verification

With a valid signed-in browser session, inspect a request to `GET /api/me` from browser devtools or a REST client that can send the Clerk bearer token.

Expected response after profile and workspace creation:

```json
{
  "status": "ok",
  "user": {
    "id": "...",
    "providerUserId": "...",
    "email": "...",
    "displayName": "..."
  },
  "memberships": [
    {
      "tenant": {
        "slug": "my-local-workspace",
        "name": "My Local Workspace"
      },
      "role": {
        "key": "owner",
        "name": "Owner"
      },
      "permissions": ["..."]
    }
  ]
}
```

Expected response for a valid Clerk user before profile bootstrap:

```json
{
  "status": "onboarding_required",
  "code": "APPLICATION_USER_NOT_FOUND"
}
```

## Expected Failures

- Missing or placeholder Clerk keys: `env:doctor` warns or fails before real-auth testing.
- API not running: `smoke:local` fails API health checks.
- Web not running: `smoke:local` fails web checks.
- New workspace has no tickets: expected until tickets are created for that tenant.
