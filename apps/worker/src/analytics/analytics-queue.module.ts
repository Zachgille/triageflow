import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { AppConfigModule } from '../runtime-config/app-config.module';
import { AppConfigService } from '../runtime-config/app-config.service';
import { analyticsQueueName } from './analytics-queue.constants';
import { AnalyticsQueueService } from './analytics-queue.service';
import { ANALYTICS_QUEUE, ANALYTICS_QUEUE_CONNECTION } from './analytics-queue.tokens';
import type { AnalyticsJobData, AnalyticsJobResult } from './analytics.types';

@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: ANALYTICS_QUEUE_CONNECTION,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new Redis(config.values.REDIS_URL, {
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: ANALYTICS_QUEUE,
      inject: [ANALYTICS_QUEUE_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue<AnalyticsJobData, AnalyticsJobResult>(analyticsQueueName, {
          connection,
        }),
    },
    AnalyticsQueueService,
  ],
  exports: [AnalyticsQueueService],
})
export class AnalyticsQueueModule {}
