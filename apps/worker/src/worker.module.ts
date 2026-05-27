import { Module } from '@nestjs/common';

import { AnalyticsModule } from './analytics/analytics.module';
import { SlaModule } from './sla/sla.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [SlaModule, AnalyticsModule],
  providers: [WorkerService],
})
export class WorkerModule {}
