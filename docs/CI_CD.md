# CI/CD

This project uses GitHub Actions to protect `main` with repeatable checks for the pnpm TypeScript monorepo, Prisma, PostgreSQL, Redis, tests, Docker builds, and GHCR image publishing.

## Create The GitHub Repository

From the repository root:

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create triageflow --private --source=. --remote=origin --push
```

If the local repository is already initialized, do not re-run `git init`. Check the current state first:

```bash
git status
git remote -v
```

If the repository exists locally but has no GitHub remote yet:

```bash
gh repo create triageflow --private --source=. --remote=origin --push
```

## Workflows

### `ci.yml`

Runs on pull requests to `main` and pushes to `main`.

Checks:

- Installs pnpm dependencies with `--frozen-lockfile`.
- Validates the Prisma schema.
- Generates Prisma Client.
- Runs linting.
- Runs TypeScript checks.
- Builds all workspace packages/apps.
- Runs unit/component tests.
- Runs live API integration tests against GitHub Actions PostgreSQL and Redis services.

The workflow uses dummy Clerk values for test configuration. No real Clerk secret is required for CI tests.

### `docker.yml`

Runs on pull requests to `main` and pushes to `main`.

Checks:

- Builds the API image from `apps/api/Dockerfile`.
- Builds the web image from `apps/web/Dockerfile`.
- Builds the worker image from `apps/worker/Dockerfile`.

This catches Dockerfile, dependency, and build-context regressions before merge.

### `release-or-deploy.yml`

Runs on pushes to `main` and can also be started manually.

Behavior:

- Logs in to GitHub Container Registry with `GITHUB_TOKEN`.
- Builds API, web, and worker images.
- Pushes each image to GHCR with both `${{ github.sha }}` and `latest` tags.

This is intentionally image publishing only. It does not deploy to AWS, Vercel, Fly.io, Render, or any production host because no production platform has been selected yet.

## Required GitHub Secrets

Current workflows require no user-created repository secrets.

- `GITHUB_TOKEN` is automatically provided by GitHub Actions and is used only for GHCR publishing.
- CI uses safe dummy Clerk values.
- Real production secrets should be added only after a deployment target is chosen.

Future deployment secrets will likely include production database, Redis, Clerk, application URL, and hosting-provider credentials. Do not add those until the deployment platform and environment model are decided.

## Branch Protection

After pushing the repository, enable branch protection for `main` in GitHub:

1. Open repository settings.
2. Go to `Branches`.
3. Add a branch protection rule for `main`.
4. Enable `Require a pull request before merging`.
5. Enable `Require status checks to pass before merging`.
6. Require the `Lint, Typecheck, Build, Test` check from `ci.yml`.
7. Require the Docker image build checks from `docker.yml`.
8. Enable `Require branches to be up to date before merging`.
9. Enable `Block force pushes`.
10. Optionally enable `Require linear history`.

Keep `release-or-deploy.yml` out of required PR checks because it publishes images only after changes reach `main`.

## Reading CI Failures

Start with the first failed job in the Actions run:

- Dependency failures usually mean `pnpm-lock.yaml` is stale. Run `corepack pnpm install` locally and commit the updated lockfile if the dependency change was intentional.
- Prisma failures usually mean schema, migration, or environment configuration drift. Run `corepack pnpm db:validate` and `corepack pnpm db:generate`.
- Typecheck or build failures usually point to package boundary or generated type issues. Run `corepack pnpm typecheck` and `corepack pnpm build`.
- Unit test failures usually identify the failing package in the Vitest output. Run `corepack pnpm test` or the package-specific test command.
- Integration failures use a real PostgreSQL service. Run `corepack pnpm test:integration` locally with Docker infrastructure running.
- Docker failures usually mean the build context, Dockerfile, generated Prisma Client, or app build command changed. Reproduce with `docker build -f apps/api/Dockerfile .`, `docker build -f apps/web/Dockerfile .`, or `docker build -f apps/worker/Dockerfile .`.

## Local Validation

Closest local equivalents:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm db:validate
corepack pnpm db:generate
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
corepack pnpm test:integration
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
docker build -f apps/worker/Dockerfile .
```

Run `corepack pnpm infra:up` before live integration tests if local PostgreSQL and Redis are not already running.

## Remaining Deployment Choices

Before real CD is added, choose:

- Hosting target for the API and worker.
- Hosting target for the Next.js web app.
- Managed PostgreSQL provider.
- Managed Redis provider.
- Production migration strategy.
- Environment and secret management model.
- Rollback strategy and health check endpoints for deployment automation.
