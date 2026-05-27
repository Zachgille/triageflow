import { describe, expect, it, vi } from 'vitest';

import { AppConfigService } from '../runtime-config/app-config.service';
import {
  slaCheckBreachesJobName,
  slaCheckBreachesJobOptions,
  slaCheckBreachesSchedulerId,
} from './sla-queue.constants';
import { resolveSlaCheckIntervalMs, SlaQueueService } from './sla-queue.service';

describe('SlaQueueService scheduling and status', () => {
  it('registers the repeatable SLA check with a stable scheduler identity', async () => {
    const queue = createMockQueue();
    const service = new SlaQueueService(
      createConfig({ SLA_CHECK_INTERVAL_SECONDS: 60 }),
      queue as never,
      createConnection() as never,
    );

    await service.ensureRepeatableSlaCheckSchedule();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      slaCheckBreachesSchedulerId,
      { every: 60_000 },
      {
        name: slaCheckBreachesJobName,
        data: {},
        opts: slaCheckBreachesJobOptions,
      },
    );
  });

  it('does not create duplicate repeatable jobs on repeated startup calls', async () => {
    const queue = createMockQueue();
    const service = new SlaQueueService(createConfig(), queue as never, createConnection() as never);

    await service.ensureRepeatableSlaCheckSchedule();
    await service.ensureRepeatableSlaCheckSchedule();

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    expect(queue.upsertJobScheduler.mock.calls.every((call) => call[0] === slaCheckBreachesSchedulerId)).toBe(
      true,
    );
  });

  it('respects custom SLA_CHECK_INTERVAL_SECONDS', async () => {
    const queue = createMockQueue();
    const service = new SlaQueueService(
      createConfig({ SLA_CHECK_INTERVAL_SECONDS: 15 }),
      queue as never,
      createConnection() as never,
    );

    await service.ensureRepeatableSlaCheckSchedule();

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      slaCheckBreachesSchedulerId,
      { every: 15_000 },
      expect.any(Object),
    );
  });

  it('rejects invalid interval config', () => {
    expect(() => resolveSlaCheckIntervalMs(0)).toThrow('SLA_CHECK_INTERVAL_SECONDS');
  });

  it('reports queue counts and repeatable job configuration', async () => {
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
        key: slaCheckBreachesSchedulerId,
        name: slaCheckBreachesJobName,
        every: 60_000,
        next: 1_779_999_999_999,
      },
    ]);
    const service = new SlaQueueService(createConfig(), queue as never, createConnection() as never);

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
          id: slaCheckBreachesSchedulerId,
          name: slaCheckBreachesJobName,
          every: 60_000,
          next: 1_779_999_999_999,
          pattern: undefined,
        },
      ],
    });
  });

  it('uses retry, backoff, and retention job options', () => {
    expect(slaCheckBreachesJobOptions).toMatchObject({
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
  });
});

function createConfig(overrides: { SLA_CHECK_INTERVAL_SECONDS?: number } = {}): AppConfigService {
  return {
    values: {
      SLA_CHECK_INTERVAL_SECONDS: overrides.SLA_CHECK_INTERVAL_SECONDS ?? 60,
    },
  } as AppConfigService;
}

function createMockQueue() {
  return {
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
