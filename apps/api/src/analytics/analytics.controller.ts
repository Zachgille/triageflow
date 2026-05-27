import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentRequestContext } from '../tenant-context/current-request-context.decorator';
import type { RequestContext } from '../tenant-context/request-context';
import { TenantContextGuard } from '../tenant-context/tenant-context.guard';
import { parseDailyRollupsQuery } from './analytics-api.validation';
import { AnalyticsService } from './analytics.service';

@Controller('api/tenants/:tenantSlug/analytics')
@UseGuards(ClerkAuthGuard, TenantContextGuard, PermissionGuard)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @RequirePermission('analytics:read')
  async getOverview(@CurrentRequestContext() ctx: RequestContext) {
    return this.analytics.getTenantOverview(ctx);
  }

  @Get('daily-rollups')
  @RequirePermission('analytics:read')
  async getDailyRollups(
    @CurrentRequestContext() ctx: RequestContext,
    @Query() query: Record<string, unknown>,
  ) {
    const { from, to } = parseDailyRollupsQuery(query);

    return {
      data: await this.analytics.getTenantDailyRollups(ctx, from, to),
    };
  }
}
