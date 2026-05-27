import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  AnalyticsRollupRepository,
  defaultRollupDate,
  normalizeUtcDate,
} from './analytics-rollup.repository';
import type { AnalyticsRollupOptions, AnalyticsRollupResult } from './analytics.types';

const yyyyMmDdPattern = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class AnalyticsRollupService {
  private readonly logger = new Logger(AnalyticsRollupService.name);

  constructor(
    @Inject(AnalyticsRollupRepository)
    private readonly repository: AnalyticsRollupRepository,
  ) {}

  async run(options: AnalyticsRollupOptions): Promise<AnalyticsRollupResult> {
    if (!options.tenantId) {
      throw new Error('ANALYTICS_ROLLUP_TENANT_ID_REQUIRED');
    }

    const startedAt = Date.now();
    const date = resolveRollupDate(options.date, options.now ?? new Date());
    const input = await this.repository.calculateDailyRollupInput(options.tenantId, date);
    const action = await this.repository.upsertDailyRollup(options.tenantId, date, input);
    const result = {
      tenantId: options.tenantId,
      date: formatUtcDate(date),
      action,
    };

    this.logger.log(
      `Analytics rollup ${action} for tenant ${options.tenantId} on ${result.date} in ${Date.now() - startedAt}ms.`,
    );

    return result;
  }
}

export function resolveRollupDate(date: Date | string | undefined, now: Date) {
  if (date instanceof Date) {
    assertValidDate(date, 'ANALYTICS_ROLLUP_DATE_INVALID');
    return normalizeUtcDate(date);
  }

  if (typeof date === 'string') {
    if (!yyyyMmDdPattern.test(date)) {
      throw new Error('ANALYTICS_ROLLUP_DATE_INVALID');
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);
    assertValidDate(parsed, 'ANALYTICS_ROLLUP_DATE_INVALID');
    return normalizeUtcDate(parsed);
  }

  assertValidDate(now, 'ANALYTICS_ROLLUP_NOW_INVALID');
  return defaultRollupDate(now);
}

export function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function assertValidDate(date: Date, errorCode: string) {
  if (Number.isNaN(date.getTime())) {
    throw new Error(errorCode);
  }
}
