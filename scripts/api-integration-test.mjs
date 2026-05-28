import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadDotenv(resolve(rootDir, '.env'));

const databaseUrl = resolveTestDatabaseUrl();
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');

if (!/test/i.test(databaseName)) {
  console.error(
    `Refusing to run live integration tests against non-test database "${databaseName}". Set TEST_DATABASE_URL to a dedicated test database.`,
  );
  process.exit(1);
}

await ensureDatabaseExists(databaseUrl);

run('corepack', ['pnpm', '--filter', '@triageflow/db', 'prisma:migrate:deploy'], {
  DATABASE_URL: databaseUrl,
});

run('corepack', ['pnpm', '--filter', '@triageflow/api', 'exec', 'vitest', 'run', '--config', 'vitest.integration.config.ts'], {
  DATABASE_URL: databaseUrl,
  NODE_ENV: 'test',
  CLERK_DEV_BEARER_AUTH: 'false',
});

function resolveTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL or TEST_DATABASE_URL is required for API integration tests.');
    process.exit(1);
  }

  const url = new URL(process.env.DATABASE_URL);
  const currentName = url.pathname.replace(/^\//, '');
  url.pathname = `/${currentName || 'triageflow'}_test`;
  return url.toString();
}

async function ensureDatabaseExists(testUrl) {
  const { PrismaClient } = await import(
    pathToFileURL(resolve(rootDir, 'packages/db/node_modules/@prisma/client/index.js')).href
  );
  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, '');
  const maintenanceUrl = new URL(testUrl);
  maintenanceUrl.pathname = '/postgres';
  maintenanceUrl.search = '';

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: maintenanceUrl.toString(),
      },
    },
  });

  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      dbName,
    );

    if (rows.length === 0) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
      console.log(`Created test database "${dbName}".`);
    }
  } catch (error) {
    console.error(`Unable to prepare test database "${dbName}". Is local PostgreSQL running?`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function run(command, args, envOverrides) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...envOverrides,
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function loadDotenv(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}
