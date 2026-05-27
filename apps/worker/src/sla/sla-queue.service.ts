import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { JobSchedulerJson, Queue } from 'bullmq';
import type { Redis } from 'ioredis';

import { AppConfigService } from '../runtime-config/app-config.service';
import {
  slaCheckBreachesJobName,
  slaCheckBreachesJobOptions,
  slaCheckBreachesSchedulerId,
} from './sla-queue.constants';
import { SLA_QUEUE, SLA_QUEUE_CONNECTION } from './sla-queue.tokens';
import type { SlaBreachCheckJobData, SlaQueueStatus } from './sla-breach.types';

@Injectable()
export class SlaQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(SlaQueueService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(SLA_QUEUE) private readonly queue: Queue<SlaBreachCheckJobData>,
    @Inject(SLA_QUEUE_CONNECTION) private readonly connection: Redis,
  ) {}

  async ensureRepeatableSlaCheckSchedule() {
    const every = resolveSlaCheckIntervalMs(this.config.values.SLA_CHECK_INTERVAL_SECONDS);

    const job = await this.queue.upsertJobScheduler(
      slaCheckBreachesSchedulerId,
      { every },
      {
        name: slaCheckBreachesJobName,
        data: {},
        opts: slaCheckBreachesJobOptions,
      },
    );

    this.logger.log(
      `Ensured repeatable SLA job scheduler "${slaCheckBreachesSchedulerId}" every ${every}ms. Next job id: ${job.id ?? 'unknown'}.`,
    );

    return job;
  }

  async getStatus(): Promise<SlaQueueStatus> {
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

export function resolveSlaCheckIntervalMs(value: unknown) {
  const intervalSeconds = Number(value);

  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 86_400) {
    throw new Error('SLA_CHECK_INTERVAL_SECONDS must be an integer between 1 and 86400.');
  }

  return intervalSeconds * 1000;
}

function toStatusScheduler(job: JobSchedulerJson<SlaBreachCheckJobData>) {
  return {
    id: job.key,
    name: job.name,
    next: job.next,
    every: job.every,
    pattern: job.pattern,
  };
}
