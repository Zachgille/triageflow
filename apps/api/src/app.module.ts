import { Module } from '@nestjs/common';

import { AnalyticsModule } from './analytics/analytics.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { CommentsModule } from './comments/comments.module';
import { DebugModule } from './debug/debug.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { OnboardingModule } from './onboarding/onboarding.module';
import { RedisModule } from './redis/redis.module';
import { RbacModule } from './rbac/rbac.module';
import { AppConfigModule } from './runtime-config/app-config.module';
import { SlaModule } from './sla/sla.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { TicketsModule } from './tickets/tickets.module';

@Module({
  imports: [
    AppConfigModule,
    AnalyticsModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    AuditModule,
    TenantContextModule,
    RbacModule,
    DebugModule,
    OnboardingModule,
    SlaModule,
    TicketsModule,
    CommentsModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
