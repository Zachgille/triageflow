import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { SlaRepository } from './sla.repository';
import { SlaService } from './sla.service';

@Module({
  imports: [DatabaseModule],
  providers: [SlaRepository, SlaService],
  exports: [SlaRepository, SlaService],
})
export class SlaModule {}
