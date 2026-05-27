import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RbacModule } from '../rbac/rbac.module';
import { SlaModule } from '../sla/sla.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TicketsController } from './tickets.controller';
import { TicketApiService } from './ticket-api.service';
import { TicketRepository } from './ticket.repository';
import { TicketService } from './ticket.service';

@Module({
  imports: [AuthModule, AuditModule, DatabaseModule, TenantContextModule, RbacModule, SlaModule],
  controllers: [TicketsController],
  providers: [TicketRepository, TicketService, TicketApiService],
  exports: [TicketRepository, TicketService, TicketApiService],
})
export class TicketsModule {}
