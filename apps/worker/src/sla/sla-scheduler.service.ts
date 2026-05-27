import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { SlaQueueService } from './sla-queue.service';

@Injectable()
export class SlaSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SlaSchedulerService.name);

  constructor(@Inject(SlaQueueService) private readonly queue: SlaQueueService) {}

  async onModuleInit() {
    try {
      await this.queue.ensureRepeatableSlaCheckSchedule();
      this.logger.log('SLA breach repeatable schedule registered.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to register SLA breach repeatable schedule: ${message}`);
    }
  }
}
