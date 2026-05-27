import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { AppConfigService } from '../runtime-config/app-config.service';
import { AnalyticsQueueService } from './analytics-queue.service';

@Injectable()
export class AnalyticsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(AnalyticsQueueService) private readonly queue: AnalyticsQueueService,
  ) {}

  async onModuleInit() {
    if (!this.config.values.ANALYTICS_ROLLUP_SCHEDULE_ENABLED) {
      this.logger.log('Analytics rollup repeatable schedule disabled.');
      return;
    }

    try {
      await this.queue.ensureRepeatableAnalyticsRollupSchedule(
        this.config.values.ANALYTICS_ROLLUP_INTERVAL_SECONDS,
      );
      this.logger.log('Analytics rollup repeatable schedule registered.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register analytics rollup repeatable schedule: ${message}`);
    }
  }
}
