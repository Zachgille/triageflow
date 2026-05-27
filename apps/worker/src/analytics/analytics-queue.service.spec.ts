import { describe, expect, it, vi } from 'vitest';

import {
  analyticsRollupDailyJobName,
  analyticsRollupDailyJobOptions,
  analyticsScheduleDailyRollupsJobName,
  analyticsScheduleDailyRollupsJobOptions,
  analyticsScheduleDailyRollupsSchedulerId,
  createAnalyticsRollupDailyJobId,
} from './analytics-queue.constants';
import { AnalyticsQueueService, resolveAnalyticsRollupIntervalMs } from './analytics-queue.service';

describe('AnalyticsQueueService', () => {
  it('enqueues the daily rollup job with deterministic tenant/date job id', async () => {
    const queue = createMockQueue();
    const service = new AnalyticsQueueService(queue as never, createConnection() as never);
    const data = { tenantId: 'tenant-a', date: '2026-05-26' };

    await service.enqueueDailyRollup(data);

    expect(queue.add).toHaveBeenCalledWith(analyticsRollupDailyJobName, data, {
      ...analyticsRollupDailyJobOptions,
      jobId: createAnalyticsRollupDailyJobId('tenant-a', '2026-05-26'),
    });
  });

  it('enqueues the scheduler job with retry and retention options', async () => {
    const queue = createMockQueue();
    const service = new AnalyticsQueueService(queue as never, createConnection() as never);
    const data = { date: '2026-05-26', limit: 50 };

    await service.enqueueScheduleDailyRollups(data);

    expect(queue.add).toHaveBeenCalledWith(
      analyticsScheduleDailyRollupsJobName,
      data,
      analyticsScheduleDailyRollupsJobOptions,
    );
  });

  it('registers repeatable analytics scheduling with a stable scheduler identity', async () => {
    const queue = createMockQueue();
    const service = new AnalyticsQueueService(queue as never, createConnection() as never);

    await service.ensureRepeatableAnalyticsRollupSchedule(3600);

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      analyticsScheduleDailyRollupsSchedulerId,
      { every: 3_600_000 },
      {
        name: analyticsScheduleDailyRollupsJobName,
        data: {},
        opts: analyticsScheduleDailyRollupsJobOptions,
      },
    );
  });

  it('uses the same stable scheduler identity on repeated registration', async () => {
    const queue = createMockQueue();
    const service = new AnalyticsQueueService(queue as never, createConnection() as never);

    await service.ensureRepeatableAnalyticsRollupSchedule(3600);
    await service.ensureRepeatableAnalyticsRollupSchedule(3600);

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(
      queue.upsertJobScheduler.mock.calls.every((call) => call[0] === analyticsScheduleDailyRollupsSchedulerId),
    ).toBe(true);
  });

  it('rejects invalid interval values', () => {
    expect(() => resolveAnalyticsRollupIntervalMs(0)).toThrow('ANALYTICS_ROLLUP_INTERVAL_SECONDS');
  });

  it('reports analytics queue counts and repeatable scheduler metadata', async () => {
    const queue = createMockQueue();
    queue.getJobCounts.mockResolvedValue({
      waiting: 1,
      active: 2,
      completed: 3,
      failed: 4,
      delayed: 5,
    });
    queue.getJobSchedulers.mockResolvedValue([
      {
        key: analyticsScheduleDailyRollupsSchedulerId,
        name: analyticsScheduleDailyRollupsJobName,
        every: 3_600_000,
        next: 1_779_999_999_999,
      },
    ]);
    const service = new AnalyticsQueueService(queue as never, createConnection() as never);

    await expect(service.getStatus()).resolves.toEqual({
      counts: {
        waiting: 1,
        active: 2,
        completed: 3,
        failed: 4,
        delayed: 5,
      },
      repeatableJobs: [
        {
          id: analyticsScheduleDailyRollupsSchedulerId,
          name: analyticsScheduleDailyRollupsJobName,
          every: 3_600_000,
          next: 1_779_999_999_999,
          pattern: undefined,
        },
      ],
    });
  });

  it('uses retry, backoff, and retention job options', () => {
    expect(analyticsRollupDailyJobOptions).toMatchObject({
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
    });
    expect(analyticsScheduleDailyRollupsJobOptions).toMatchObject(analyticsRollupDailyJobOptions);
  });
});

function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'analytics-job-id' }),
    upsertJobScheduler: vi.fn().mockResolvedValue({ id: 'next-job-id' }),
    getJobCounts: vi.fn().mockResolvedValue({}),
    getJobSchedulers: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  };
}

function createConnection() {
  return {
    disconnect: vi.fn(),
  };
}
