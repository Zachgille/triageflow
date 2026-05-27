import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AppConfigModule } from '../runtime-config/app-config.module';
import { SlaBreachCheckService } from './sla-breach-check.service';
import { SlaBreachRepository } from './sla-breach.repository';
import { SlaBreachWorker } from './sla-breach.worker';
import { SlaQueueModule } from './sla-queue.module';
import { SlaSchedulerService } from './sla-scheduler.service';

@Module({
  imports: [AppConfigModule, DatabaseModule, SlaQueueModule],
  providers: [SlaBreachRepository, SlaBreachCheckService, SlaBreachWorker, SlaSchedulerService],
  exports: [SlaBreachCheckService],
})
export class SlaModule {}
