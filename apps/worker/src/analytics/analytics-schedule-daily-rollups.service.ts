import { Inject, Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../runtime-config/app-config.service';
import { AnalyticsQueueService } from './analytics-queue.service';
import { defaultRollupDate } from './analytics-rollup.repository';
import { formatUtcDate, resolveRollupDate } from './analytics-rollup.service';
import { AnalyticsRollupRepository } from './analytics-rollup.repository';
import type {
  AnalyticsScheduleDailyRollupsJobData,
  AnalyticsScheduleDailyRollupsResult,
} from './analytics.types';

@Injectable()
export class AnalyticsScheduleDailyRollupsService {
  private readonly logger = new Logger(AnalyticsScheduleDailyRollupsService.name);

  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(AnalyticsRollupRepository) private readonly repository: AnalyticsRollupRepository,
    @Inject(AnalyticsQueueService) private readonly queue: AnalyticsQueueService,
  ) {}

  async run(data: AnalyticsScheduleDailyRollupsJobData = {}): Promise<AnalyticsScheduleDailyRollupsResult> {
    const startedAt = Date.now();
    const tenantBatchSize = resolveAnalyticsTenantBatchSize(
      data.limit ?? this.config.values.ANALYTICS_ROLLUP_TENANT_BATCH_SIZE,
    );
    const date = data.date
      ? resolveRollupDate(data.date, data.now ? new Date(data.now) : new Date())
      : defaultRollupDate(data.now ? new Date(data.now) : new Date());
    const formattedDate = formatUtcDate(date);
    const tenantIds = await this.repository.findTenantIds(tenantBatchSize);

    let enqueuedRollupJobs = 0;

    for (const tenantId of tenantIds) {
      await this.queue.enqueueDailyRollup({
        tenantId,
        date: formattedDate,
      });
      enqueuedRollupJobs += 1;
    }

    const result = {
      date: formattedDate,
      tenantBatchSize,
      loadedTenants: tenantIds.length,
      enqueuedRollupJobs,
      skippedDuplicateJobs: 0,
    };

    this.logger.log(
      `Scheduled analytics rollups for ${result.loadedTenants} tenants on ${result.date} with batch size ${tenantBatchSize}; enqueued ${enqueuedRollupJobs} jobs in ${Date.now() - startedAt}ms.`,
    );

    return result;
  }
}

export function resolveAnalyticsTenantBatchSize(value: unknown) {
  const batchSize = Number(value);

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error('ANALYTICS_ROLLUP_TENANT_BATCH_SIZE must be an integer between 1 and 1000.');
  }

  return batchSize;
}
