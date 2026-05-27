# Environment Setup

This guide uses Windows PowerShell from the repository root.

## Create `.env`

Copy the checked-in template:

```powershell
Copy-Item .env.example .env
```

`.env` is for local secrets and machine-specific settings. Do not commit it.

Run the environment doctor:

```powershell
corepack pnpm env:doctor
```

The doctor checks required local values without printing secrets.

## Start Local Infrastructure

Start PostgreSQL and Redis:

```powershell
corepack pnpm infra:up
```

Apply migrations, generate Prisma Client, and seed local data:

```powershell
corepack pnpm db:migrate
corepack pnpm db:generate
corepack pnpm db:seed
```

## Clerk Keys

Create or open a Clerk application in the Clerk dashboard and copy the local development keys.

Set these in `.env`:

```powershell
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_AUTHORIZED_PARTIES="http://localhost:3000"
```

`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is public. It is bundled into the browser and must never contain secrets.

`CLERK_SECRET_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`, never paste it into frontend code, and never commit it.

`CLERK_JWT_KEY` is optional for the current local flow. Leave it blank unless Clerk JWT verification for the environment requires it.

`CLERK_DEV_BEARER_AUTH` must remain `false` by default. Set it to `true` only for explicit local fallback testing, and never use it outside `NODE_ENV=development`.

## Required Variables

`.env.example` contains the current required local variables:

- `DATABASE_URL`
- `REDIS_URL`
- `APP_BASE_URL`
- `NODE_ENV`
- `PORT`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_JWT_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `CLERK_DEV_BEARER_AUTH`

For default Docker Compose services:

```powershell
DATABASE_URL="postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public"
REDIS_URL="redis://localhost:6379"
APP_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_API_BASE_URL="http://localhost:3001"
PORT="3001"
NODE_ENV="development"
```

## Local Reachability Smoke Check

After the API and web app are running:

```powershell
corepack pnpm smoke:local
```

This checks:

- `GET /health/live`
- `GET /health/ready`
- web root page
- `/onboarding`

It does not automate Clerk sign-in.

## Web Environment Loading

The web app scripts load the repository-root `.env` through `scripts/with-root-env.mjs`. The wrapper intentionally does not forward `NODE_ENV` from `.env`, because Next.js controls `NODE_ENV` for development and production builds.

Browser API calls use same-origin `/api/...` URLs. Next.js rewrites those requests to `NEXT_PUBLIC_API_BASE_URL`, which avoids browser CORS issues while keeping the backend on `localhost:3001`.
