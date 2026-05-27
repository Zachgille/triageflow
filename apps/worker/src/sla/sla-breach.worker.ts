import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { AppConfigService } from '../runtime-config/app-config.service';
import { SlaBreachCheckService } from './sla-breach-check.service';
import { slaCheckBreachesJobName, slaQueueName } from './sla-queue.constants';
import type { SlaBreachCheckJobData, SlaBreachCheckResult } from './sla-breach.types';

@Injectable()
export class SlaBreachWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SlaBreachWorker.name);
  private connection?: Redis;
  private worker?: Worker<SlaBreachCheckJobData, SlaBreachCheckResult>;
  private readonly startedAtByJobId = new Map<string, number>();

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(SlaBreachCheckService) private readonly breachCheck: SlaBreachCheckService,
  ) {}

  onModuleInit() {
    this.connection = new Redis(this.config.values.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    this.worker = new Worker<SlaBreachCheckJobData, SlaBreachCheckResult>(
      slaQueueName,
      async (job) => {
        if (job.name !== slaCheckBreachesJobName) {
          throw new Error(`Unsupported SLA job: ${job.name}`);
        }

        const startedAt = new Date();
        this.startedAtByJobId.set(job.id ?? 'unknown', startedAt.getTime());
        this.logger.log(
          `Started ${job.name} job ${job.id ?? 'unknown'} at ${startedAt.toISOString()}.`,
        );

        return this.breachCheck.run({
          ...(job.data.tenantId !== undefined ? { tenantId: job.data.tenantId } : {}),
          ...(job.data.limit !== undefined ? { limit: job.data.limit } : {}),
          ...(job.data.now !== undefined ? { now: new Date(job.data.now) } : {}),
        });
      },
      { connection: this.connection },
    );

    this.worker.on('completed', (job, result) => {
      const completedAt = new Date();
      const startedAt = this.startedAtByJobId.get(job.id ?? 'unknown') ?? completedAt.getTime();
      this.startedAtByJobId.delete(job.id ?? 'unknown');
      this.logger.log(
        `Completed ${job.name} job ${job.id ?? 'unknown'} at ${completedAt.toISOString()} in ${completedAt.getTime() - startedAt}ms. Scanned ${result.scannedTickets} tickets, created ${result.createdBreaches} breaches, skipped ${result.existingBreaches} duplicate breaches.`,
      );
    });
    this.worker.on('failed', (job, error) => {
      const failedAt = new Date();
      this.startedAtByJobId.delete(job?.id ?? 'unknown');
      this.logger.error(
        `Failed ${job?.name ?? 'unknown'} job ${job?.id ?? 'unknown'} at ${failedAt.toISOString()}: ${error.message}`,
      );
    });
    this.worker.on('error', (error) => {
      this.logger.error(`SLA worker error: ${error.message}`);
    });
    this.logger.log(`Registered BullMQ worker for queue "${slaQueueName}".`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
    this.connection?.disconnect();
  }
}
