import type { AnalyticsScheduleDailyRollupsJobData } from './analytics.types';

export function parseAnalyticsScheduleArgs(args: string[]): AnalyticsScheduleDailyRollupsJobData {
  const parsed: AnalyticsScheduleDailyRollupsJobData = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    const [rawKey, inlineValue] = arg.replace(/^--/, '').split('=', 2);
    const value = inlineValue ?? (!args[index + 1]?.startsWith('--') ? args[index + 1] : undefined);

    if (!value) {
      continue;
    }

    if (!inlineValue) {
      index += 1;
    }

    if (rawKey === 'date') {
      parsed.date = value;
    }

    if (rawKey === 'now') {
      parsed.now = value;
    }

    if (rawKey === 'limit') {
      parsed.limit = Number(value);
    }
  }

  return parsed;
}
