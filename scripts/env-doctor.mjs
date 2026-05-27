import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.env');
const envExamplePath = resolve('.env.example');
const checks = [];

if (!existsSync(envPath)) {
  fail('.env exists', 'Create it with: Copy-Item .env.example .env');
  printResults();
  process.exitCode = 1;
} else {
  pass('.env exists');
}

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const exampleEnv = existsSync(envExamplePath) ? parseEnv(readFileSync(envExamplePath, 'utf8')) : {};

const requiredServerVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'APP_BASE_URL',
  'NODE_ENV',
  'PORT',
  'CLERK_SECRET_KEY',
  'CLERK_DEV_BEARER_AUTH',
];
const requiredFrontendVars = ['NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'];
const optionalVars = [
  'CLERK_JWT_KEY',
  'CLERK_AUTHORIZED_PARTIES',
  'SLA_CHECK_INTERVAL_SECONDS',
  'ANALYTICS_ROLLUP_SCHEDULE_ENABLED',
  'ANALYTICS_ROLLUP_INTERVAL_SECONDS',
  'ANALYTICS_ROLLUP_TENANT_BATCH_SIZE',
];

for (const key of [...requiredServerVars, ...requiredFrontendVars]) {
  checkPresent(key, env);
}

for (const key of [...requiredServerVars, ...requiredFrontendVars, ...optionalVars]) {
  if (!(key in exampleEnv)) {
    fail(`.env.example includes ${key}`, 'Add the variable to .env.example.');
  } else {
    pass(`.env.example includes ${key}`);
  }
}

checkUrl('DATABASE_URL', env.DATABASE_URL);
checkUrl('REDIS_URL', env.REDIS_URL);
checkUrl('APP_BASE_URL', env.APP_BASE_URL);
checkUrl('NEXT_PUBLIC_API_BASE_URL', env.NEXT_PUBLIC_API_BASE_URL);
checkLocalDatabase(env.DATABASE_URL);
checkBooleanDefault('CLERK_DEV_BEARER_AUTH', env.CLERK_DEV_BEARER_AUTH);
checkBooleanDefault('ANALYTICS_ROLLUP_SCHEDULE_ENABLED', env.ANALYTICS_ROLLUP_SCHEDULE_ENABLED);
checkKeyShape('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, /^pk_(test|live)_[A-Za-z0-9_-]+$/);
checkKeyShape('CLERK_SECRET_KEY', env.CLERK_SECRET_KEY, /^sk_(test|live)_[A-Za-z0-9_-]+$/);
checkNoPublicSecret(env);

printResults();

if (checks.some((check) => check.status === 'fail')) {
  process.exitCode = 1;
}

function parseEnv(contents) {
  const result = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');

    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    result[key] = unquote(rawValue);
  }

  return result;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function checkPresent(key, values) {
  if (!values[key]) {
    fail(`${key} is set`, `Set ${key} in .env.`);
    return;
  }

  pass(`${key} is set`);
}

function checkUrl(key, value) {
  if (!value) {
    return;
  }

  try {
    new URL(value);
    pass(`${key} is a valid URL`);
  } catch {
    fail(`${key} is a valid URL`, `Update ${key}; the current value is not a valid URL.`);
  }
}

function checkLocalDatabase(value) {
  if (!value) {
    return;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    if (['localhost', '127.0.0.1', '::1'].includes(host)) {
      pass('DATABASE_URL points to local database');
      return;
    }

    if (process.env.TRIAGEFLOW_ALLOW_REMOTE_DATABASE === 'true') {
      warn('DATABASE_URL is remote', 'TRIAGEFLOW_ALLOW_REMOTE_DATABASE=true is set for this doctor run.');
      return;
    }

    fail(
      'DATABASE_URL points to local database',
      'Use localhost for local development, or rerun with TRIAGEFLOW_ALLOW_REMOTE_DATABASE=true if intentional.',
    );
  } catch {
    // URL shape is reported by checkUrl.
  }
}

function checkBooleanDefault(key, value) {
  if (!value) {
    return;
  }

  if (value !== 'false') {
    fail(`${key} is false`, `${key} must default to false. Enable it only for explicit local fallback testing.`);
    return;
  }

  pass(`${key} is false`);
}

function checkKeyShape(key, value, pattern) {
  if (!value) {
    return;
  }

  if (value.includes('placeholder')) {
    warn(`${key} is still a placeholder`, `Replace ${key} with a real Clerk key before real-auth smoke testing.`);
    return;
  }

  if (!pattern.test(value)) {
    fail(`${key} has expected Clerk key shape`, `${key} should look like pk_test_..., pk_live_..., sk_test_..., or sk_live_....`);
    return;
  }

  pass(`${key} has expected Clerk key shape`);
}

function checkNoPublicSecret(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith('NEXT_PUBLIC_')) {
      continue;
    }

    if (key.includes('SECRET') || key.includes('TOKEN') || key.includes('PRIVATE') || value.startsWith('sk_')) {
      fail('No secret is exposed through NEXT_PUBLIC_*', `Review ${key}; public frontend variables are bundled into the browser.`);
      return;
    }
  }

  pass('No secret is exposed through NEXT_PUBLIC_*');
}

function pass(name) {
  checks.push({ status: 'pass', name });
}

function warn(name, detail) {
  checks.push({ status: 'warn', name, detail });
}

function fail(name, detail) {
  checks.push({ status: 'fail', name, detail });
}

function printResults() {
  for (const check of checks) {
    const icon = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
    console.log(`${icon} ${check.name}`);

    if (check.detail) {
      console.log(`     ${check.detail}`);
    }
  }
}
