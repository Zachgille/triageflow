import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const benchmarks = {
  tickets: 'infra/k6/ticket-list.js',
  comments: 'infra/k6/comments.js',
  mixed: 'infra/k6/mixed-workload.js',
};

const benchmark = process.argv[2];

if (!benchmark || !benchmarks[benchmark]) {
  console.error(`Usage: node scripts/run-k6.mjs <${Object.keys(benchmarks).join('|')}>`);
  process.exit(1);
}

const k6Bin = resolveK6Binary();
const scriptPath = resolve(benchmarks[benchmark]);
const outputDir = process.env.BENCH_OUTPUT_DIR || 'benchmark-results/local';
const summaryPath = resolve(outputDir, `${benchmark}-${timestamp()}.json`);

mkdirSync(dirname(summaryPath), { recursive: true });

console.log(`Running k6 benchmark "${benchmark}"`);
console.log(`k6 binary: ${k6Bin}`);
console.log(`script: ${scriptPath}`);
console.log(`summary export: ${summaryPath}`);
console.log('Benchmark env:');

for (const key of [
  'API_BASE_URL',
  'TENANT_SLUG',
  'BENCH_AUTH_TOKEN',
  'BENCH_ASSIGNEE_USER_ID',
  'VUS',
  'DURATION',
]) {
  const value = process.env[key];
  console.log(`  ${key}=${key.includes('TOKEN') && value ? '[set]' : value || '[default]'}`);
}

const result = spawnSync(k6Bin, ['run', '--summary-export', summaryPath, scriptPath], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: false,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function resolveK6Binary() {
  if (process.env.K6_BIN) {
    const configured = resolve(process.env.K6_BIN);

    if (!existsSync(configured)) {
      console.error(`K6_BIN is set but does not exist: ${configured}`);
      process.exit(1);
    }

    return configured;
  }

  const pathCommand = process.platform === 'win32' ? 'where.exe' : 'which';
  const pathResult = spawnSync(pathCommand, ['k6'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const firstPathMatch = pathResult.stdout?.split(/\r?\n/).find(Boolean);

  if (firstPathMatch) {
    return firstPathMatch.trim();
  }

  if (process.platform === 'win32') {
    const commonWindowsPath = 'C:\\Program Files\\k6\\k6.exe';

    if (existsSync(commonWindowsPath)) {
      return commonWindowsPath;
    }
  }

  console.error('k6 was not found. Install k6, add it to PATH, or set K6_BIN to the k6 executable.');
  process.exit(1);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
