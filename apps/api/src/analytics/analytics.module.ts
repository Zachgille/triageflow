import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RbacModule } from '../rbac/rbac.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [AuthModule, DatabaseModule, TenantContextModule, RbacModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService],
  exports: [AnalyticsRepository, AnalyticsService],
})
export class AnalyticsModule {}
