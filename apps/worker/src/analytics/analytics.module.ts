import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AppConfigModule } from '../runtime-config/app-config.module';
import { AnalyticsQueueModule } from './analytics-queue.module';
import { AnalyticsRollupRepository } from './analytics-rollup.repository';
import { AnalyticsRollupService } from './analytics-rollup.service';
import { AnalyticsRollupWorker } from './analytics-rollup.worker';
import { AnalyticsScheduleDailyRollupsService } from './analytics-schedule-daily-rollups.service';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';

@Module({
  imports: [AppConfigModule, DatabaseModule, AnalyticsQueueModule],
  providers: [
    AnalyticsRollupRepository,
    AnalyticsRollupService,
    AnalyticsScheduleDailyRollupsService,
    AnalyticsRollupWorker,
    AnalyticsSchedulerService,
  ],
  exports: [AnalyticsRollupService],
})
export class AnalyticsModule {}
