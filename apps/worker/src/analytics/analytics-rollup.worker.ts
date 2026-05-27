import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { AppConfigService } from '../runtime-config/app-config.service';
import {
  analyticsQueueName,
  analyticsRollupDailyJobName,
  analyticsScheduleDailyRollupsJobName,
} from './analytics-queue.constants';
import { AnalyticsRollupService } from './analytics-rollup.service';
import { AnalyticsScheduleDailyRollupsService } from './analytics-schedule-daily-rollups.service';
import type { AnalyticsJobData, AnalyticsJobResult } from './analytics.types';

@Injectable()
export class AnalyticsRollupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsRollupWorker.name);
  private connection?: Redis;
  private worker?: Worker<AnalyticsJobData, AnalyticsJobResult>;
  private readonly startedAtByJobId = new Map<string, number>();

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(AnalyticsRollupService) private readonly rollups: AnalyticsRollupService,
    @Inject(AnalyticsScheduleDailyRollupsService)
    private readonly scheduler: AnalyticsScheduleDailyRollupsService,
  ) {}

  onModuleInit() {
    this.connection = new Redis(this.config.values.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<AnalyticsJobData, AnalyticsJobResult>(
      analyticsQueueName,
      async (job) => {
        const startedAt = new Date();
        this.startedAtByJobId.set(job.id ?? 'unknown', startedAt.getTime());
        this.logger.log(
          `Started ${job.name} job ${job.id ?? 'unknown'} at ${startedAt.toISOString()}.`,
        );

        if (job.name === analyticsRollupDailyJobName) {
          const data = job.data;
          return this.rollups.run({
            tenantId: 'tenantId' in data ? data.tenantId ?? '' : '',
            ...('date' in data && data.date !== undefined ? { date: data.date } : {}),
            ...('now' in data && data.now !== undefined ? { now: new Date(data.now) } : {}),
          });
        }

        if (job.name === analyticsScheduleDailyRollupsJobName) {
          return this.scheduler.run(job.data);
        }

        throw new Error(`Unsupported analytics job: ${job.name}`);
      },
      { connection: this.connection },
    );

    this.worker.on('completed', (job, result) => {
      const completedAt = new Date();
      const startedAt = this.startedAtByJobId.get(job.id ?? 'unknown') ?? completedAt.getTime();
      this.startedAtByJobId.delete(job.id ?? 'unknown');
      this.logger.log(formatCompletionLog(job.name, job.id ?? 'unknown', completedAt, completedAt.getTime() - startedAt, result));
    });
    this.worker.on('failed', (job, error) => {
      const failedAt = new Date();
      this.startedAtByJobId.delete(job?.id ?? 'unknown');
      this.logger.error(
        `Failed ${job?.name ?? 'unknown'} job ${job?.id ?? 'unknown'} at ${failedAt.toISOString()}: ${error.message}`,
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(`Analytics worker error: ${error.message}`);
    });
    this.logger.log(`Registered BullMQ worker for queue "${analyticsQueueName}".`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    this.connection?.disconnect();
  }
}

function formatCompletionLog(
  jobName: string,
  jobId: string,
  completedAt: Date,
  durationMs: number,
  result: AnalyticsJobResult,
) {
  if ('tenantId' in result) {
    return `Completed ${jobName} job ${jobId} at ${completedAt.toISOString()} in ${durationMs}ms. ${result.action} analytics rollup for tenant ${result.tenantId} on ${result.date}.`;
  }

  return `Completed ${jobName} job ${jobId} at ${completedAt.toISOString()} in ${durationMs}ms. Target date ${result.date}, loaded ${result.loadedTenants} tenants, enqueued ${result.enqueuedRollupJobs} rollup jobs, skipped ${result.skippedDuplicateJobs} duplicates.`;
}
