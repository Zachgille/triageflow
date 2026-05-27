import { describe, expect, it, vi } from 'vitest';

import { AnalyticsSchedulerService } from './analytics-scheduler.service';

describe('AnalyticsSchedulerService', () => {
  it('registers only when enabled', async () => {
    const queue = { ensureRepeatableAnalyticsRollupSchedule: vi.fn().mockResolvedValue({}) };
    const service = new AnalyticsSchedulerService(
      createConfig({ enabled: true, interval: 3600 }) as never,
      queue as never,
    );

    await service.onModuleInit();

    expect(queue.ensureRepeatableAnalyticsRollupSchedule).toHaveBeenCalledWith(3600);
  });

  it('does not register when disabled', async () => {
    const queue = { ensureRepeatableAnalyticsRollupSchedule: vi.fn().mockResolvedValue({}) };
    const service = new AnalyticsSchedulerService(
      createConfig({ enabled: false, interval: 3600 }) as never,
      queue as never,
    );

    await service.onModuleInit();

    expect(queue.ensureRepeatableAnalyticsRollupSchedule).not.toHaveBeenCalled();
  });
});

function createConfig({ enabled, interval }: { enabled: boolean; interval: number }) {
  return {
    values: {
      ANALYTICS_ROLLUP_SCHEDULE_ENABLED: enabled,
      ANALYTICS_ROLLUP_INTERVAL_SECONDS: interval,
    },
  };
}
