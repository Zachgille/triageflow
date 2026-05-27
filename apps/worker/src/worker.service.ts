import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);

  onModuleInit() {
    this.logger.log('Worker process started.');
  }
}
