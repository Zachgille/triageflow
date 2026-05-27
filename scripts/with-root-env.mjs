import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const [, , command, ...args] = process.argv;

if (!command) {
  console.error('Usage: node scripts/with-root-env.mjs <command> [...args]');
  process.exit(1);
}

const env = { ...process.env };
const envPath = resolve(process.cwd(), '..', '..', '.env');

if (existsSync(envPath)) {
  const parsed = parseEnv(readFileSync(envPath, 'utf8'));

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'NODE_ENV') {
      continue;
    }

    env[key] = value;
  }
}

const executable = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : command;
const executableArgs =
  process.platform === 'win32' ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args;

const child = spawn(executable, executableArgs, {
  env,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

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
