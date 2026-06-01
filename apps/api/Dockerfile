FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV DATABASE_URL="postgresql://triageflow:triageflow@localhost:5432/triageflow?schema=public" \
    REDIS_URL="redis://localhost:6379" \
    APP_BASE_URL="http://localhost:3000"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack pnpm install --frozen-lockfile

COPY . .

RUN corepack pnpm --filter @triageflow/db prisma:generate
RUN corepack pnpm --filter @triageflow/config build \
  && corepack pnpm --filter @triageflow/db build \
  && corepack pnpm --filter @triageflow/shared build \
  && corepack pnpm --filter @triageflow/api build

ENV NODE_ENV="production"

EXPOSE 3001

CMD ["corepack", "pnpm", "--filter", "@triageflow/api", "start"]
