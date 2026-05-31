import { Inject, Injectable } from '@nestjs/common';

import type { RequestContext } from '../tenant-context/request-context';
import { AnalyticsRepository, normalizeUtcDate } from './analytics.repository';
import type { AnalyticsDailyRollupResponse } from './analytics.types';

const internalNoteReadPermission = 'comment:read_internal';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository) {}

  async calculateDailyRollupForTenantDate(tenantId: string, date: Date) {
    const normalizedDate = normalizeUtcDate(date);
    const data = await this.analytics.calculateDailyRollupInput(tenantId, normalizedDate);

    return this.analytics.upsertDailyRollup(tenantId, normalizedDate, data);
  }

  getTenantOverview(ctx: RequestContext) {
    return this.analytics.getOverview(ctx);
  }

  async getTenantDailyRollups(
    ctx: RequestContext,
    from: Date,
    to: Date,
  ): Promise<AnalyticsDailyRollupResponse[]> {
    const includeInternalNoteCount = ctx.permissions.includes(internalNoteReadPermission);
    const rollups = await this.analytics.getDailyRollups(ctx, normalizeUtcDate(from), normalizeUtcDate(to));

    return rollups.map((rollup) => ({
      id: rollup.id,
      date: rollup.date,
      openedCount: rollup.openedCount,
      resolvedCount: rollup.resolvedCount,
      closedCount: rollup.closedCount,
      publicCommentCount: rollup.publicCommentCount,
      ...(includeInternalNoteCount ? { internalNoteCount: rollup.internalNoteCount } : {}),
      firstResponseSlaBreachCount: rollup.firstResponseSlaBreachCount,
      resolutionSlaBreachCount: rollup.resolutionSlaBreachCount,
      avgFirstResponseSeconds: rollup.avgFirstResponseSeconds,
      avgResolutionSeconds: rollup.avgResolutionSeconds,
    }));
  }
}
