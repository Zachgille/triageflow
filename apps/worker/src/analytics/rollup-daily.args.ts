import type { AnalyticsRollupDailyJobData } from './analytics.types';

export function parseAnalyticsRollupArgs(args: string[]): AnalyticsRollupDailyJobData {
  const parsed: AnalyticsRollupDailyJobData = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    const [rawKey, inlineValue] = arg.replace(/^--/, '').split('=', 2);
    const key = rawKey === 'tenant' ? 'tenantId' : rawKey;
    const value = inlineValue ?? (!args[index + 1]?.startsWith('--') ? args[index + 1] : undefined);

    if (!value) {
      continue;
    }

    if (!inlineValue) {
      index += 1;
    }

    if (key === 'tenantId') {
      parsed.tenantId = value;
    }

    if (key === 'date') {
      parsed.date = value;
    }

    if (key === 'now') {
      parsed.now = value;
    }
  }

  if (!parsed.tenantId) {
    throw new Error('Usage: worker:analytics:rollup -- --tenant <tenantId> [--date YYYY-MM-DD]');
  }

  return parsed;
}
