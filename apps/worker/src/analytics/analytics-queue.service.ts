import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { JobSchedulerJson, Queue } from 'bullmq';
import type { Redis } from 'ioredis';

import {
  analyticsScheduleDailyRollupsJobName,
  analyticsScheduleDailyRollupsJobOptions,
  analyticsScheduleDailyRollupsSchedulerId,
  analyticsRollupDailyJobName,
  analyticsRollupDailyJobOptions,
  createAnalyticsRollupDailyJobId,
} from './analytics-queue.constants';
import { ANALYTICS_QUEUE, ANALYTICS_QUEUE_CONNECTION } from './analytics-queue.tokens';
import type {
  AnalyticsRollupDailyJobData,
  AnalyticsJobData,
  AnalyticsJobResult,
  AnalyticsScheduleDailyRollupsJobData,
  QueueStatus,
} from './analytics.types';

@Injectable()
export class AnalyticsQueueService implements OnModuleDestroy {
  constructor(
    @Inject(ANALYTICS_QUEUE)
    private readonly queue: Queue<AnalyticsJobData, AnalyticsJobResult>,
    @Inject(ANALYTICS_QUEUE_CONNECTION)
    private readonly connection: Redis,
  ) {}

  async enqueueDailyRollup(data: AnalyticsRollupDailyJobData) {
    return this.queue.add(analyticsRollupDailyJobName, data, {
      ...analyticsRollupDailyJobOptions,
      ...(data.tenantId && data.date ? { jobId: createAnalyticsRollupDailyJobId(data.tenantId, data.date) } : {}),
    });
  }

  async enqueueScheduleDailyRollups(data: AnalyticsScheduleDailyRollupsJobData = {}) {
    return this.queue.add(analyticsScheduleDailyRollupsJobName, data, analyticsScheduleDailyRollupsJobOptions);
  }

  async ensureRepeatableAnalyticsRollupSchedule(intervalSeconds: number) {
    const every = resolveAnalyticsRollupIntervalMs(intervalSeconds);

    return this.queue.upsertJobScheduler(
      analyticsScheduleDailyRollupsSchedulerId,
      { every },
      {
        name: analyticsScheduleDailyRollupsJobName,
        data: {},
        opts: analyticsScheduleDailyRollupsJobOptions,
      },
    );
  }

  async getStatus(): Promise<QueueStatus> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    const repeatableJobs = await this.queue.getJobSchedulers(0, -1, true);

    return {
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      },
      repeatableJobs: repeatableJobs.map(toStatusScheduler),
    };
  }

  async onModuleDestroy() {
    await this.queue.close();
    this.connection.disconnect();
  }
}

export function resolveAnalyticsRollupIntervalMs(value: unknown) {
  const intervalSeconds = Number(value);

  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 86_400) {
    throw new Error('ANALYTICS_ROLLUP_INTERVAL_SECONDS must be an integer between 1 and 86400.');
  }

  return intervalSeconds * 1000;
}

function toStatusScheduler(job: JobSchedulerJson<AnalyticsJobData>) {
  return {
    id: job.key,
    name: job.name,
    next: job.next,
    every: job.every,
    pattern: job.pattern,
  };
}
