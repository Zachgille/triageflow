import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { TicketsModule } from '../tickets/tickets.module';
import { CommentRepository } from './comment.repository';
import { CommentService } from './comment.service';
import { CommentsController } from './comments.controller';

@Module({
  imports: [AuthModule, AuditModule, DatabaseModule, TenantContextModule, RbacModule, TicketsModule],
  controllers: [CommentsController],
  providers: [CommentRepository, CommentService],
})
export class CommentsModule {}
