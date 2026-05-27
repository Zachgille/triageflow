import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { AppConfigModule } from '../runtime-config/app-config.module';
import { AppConfigService } from '../runtime-config/app-config.service';
import { slaQueueName } from './sla-queue.constants';
import { SlaQueueService } from './sla-queue.service';
import { SLA_QUEUE, SLA_QUEUE_CONNECTION } from './sla-queue.tokens';
import type { SlaBreachCheckJobData } from './sla-breach.types';

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: SLA_QUEUE_CONNECTION,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new Redis(config.values.REDIS_URL, {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: SLA_QUEUE,
      inject: [SLA_QUEUE_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue<SlaBreachCheckJobData>(slaQueueName, {
          connection,
        }),
    },
    SlaQueueService,
  ],
  exports: [SlaQueueService],
})
export class SlaQueueModule {}
