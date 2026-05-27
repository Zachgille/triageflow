export const analyticsQueueName = 'analytics';
export const analyticsRollupDailyJobName = 'rollup-daily';
export const analyticsScheduleDailyRollupsJobName = 'schedule-daily-rollups';
export const analyticsScheduleDailyRollupsSchedulerId = 'analytics:schedule-daily-rollups:every-interval';

export const analyticsRollupDailyJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: {
    age: 86_400,
    count: 1_000,
  },
  removeOnFail: {
    age: 604_800,
    count: 1_000,
  },
} as const;

export const analyticsScheduleDailyRollupsJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5_000,
  },
  removeOnComplete: {
    age: 86_400,
    count: 1_000,
  },
  removeOnFail: {
    age: 604_800,
    count: 1_000,
  },
} as const;

export function createAnalyticsRollupDailyJobId(tenantId: string, date: string) {
  return `analytics:rollup-daily:${tenantId}:${date}`;
}
