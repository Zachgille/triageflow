import { Inject, Injectable } from '@nestjs/common';

import type { RequestContext } from '../tenant-context/request-context';
import { AnalyticsRepository, normalizeUtcDate } from './analytics.repository';

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

  getTenantDailyRollups(ctx: RequestContext, from: Date, to: Date) {
    return this.analytics.getDailyRollups(ctx, normalizeUtcDate(from), normalizeUtcDate(to));
  }
}
