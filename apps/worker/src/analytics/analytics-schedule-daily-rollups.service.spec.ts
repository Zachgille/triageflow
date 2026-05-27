import { describe, expect, it, vi } from 'vitest';

import {
  AnalyticsScheduleDailyRollupsService,
  resolveAnalyticsTenantBatchSize,
} from './analytics-schedule-daily-rollups.service';

describe('AnalyticsScheduleDailyRollupsService', () => {
  it('targets yesterday UTC by default', async () => {
    const { service, repository, queue } = createService();

    await expect(service.run({ now: '2026-05-27T12:00:00.000Z' })).resolves.toMatchObject({
      date: '2026-05-26',
    });

    expect(repository.findTenantIds).toHaveBeenCalledWith(100);
    expect(queue.enqueueDailyRollup).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      date: '2026-05-26',
    });
  });

  it('fetches tenants with configured batch limit', async () => {
    const { service, repository } = createService({ batchSize: 25 });

    await service.run({ now: '2026-05-27T12:00:00.000Z' });

    expect(repository.findTenantIds).toHaveBeenCalledWith(25);
  });

  it('allows job limit override', async () => {
    const { service, repository } = createService({ batchSize: 100 });

    await service.run({ limit: 2, now: '2026-05-27T12:00:00.000Z' });

    expect(repository.findTenantIds).toHaveBeenCalledWith(2);
  });

  it('enqueues one rollup-daily job per tenant/date', async () => {
    const { service, queue } = createService({ tenants: ['tenant-a', 'tenant-b'] });

    await expect(service.run({ date: '2026-05-26' })).resolves.toEqual({
      date: '2026-05-26',
      tenantBatchSize: 100,
      loadedTenants: 2,
      enqueuedRollupJobs: 2,
      skippedDuplicateJobs: 0,
    });

    expect(queue.enqueueDailyRollup).toHaveBeenCalledWith({ tenantId: 'tenant-a', date: '2026-05-26' });
    expect(queue.enqueueDailyRollup).toHaveBeenCalledWith({ tenantId: 'tenant-b', date: '2026-05-26' });
  });

  it('rejects invalid tenant batch size config', () => {
    expect(() => resolveAnalyticsTenantBatchSize(0)).toThrow('ANALYTICS_ROLLUP_TENANT_BATCH_SIZE');
  });
});

function createService({
  batchSize = 100,
  tenants = ['tenant-a'],
}: {
  batchSize?: number;
  tenants?: string[];
} = {}) {
  const repository = {
    findTenantIds: vi.fn().mockResolvedValue(tenants),
  };
  const queue = {
    enqueueDailyRollup: vi.fn().mockResolvedValue({ id: 'job-id' }),
  };
  const config = {
    values: {
      ANALYTICS_ROLLUP_TENANT_BATCH_SIZE: batchSize,
    },
  };

  return {
    service: new AnalyticsScheduleDailyRollupsService(config as never, repository as never, queue as never),
    repository,
    queue,
  };
}
