import { describe, expect, it, vi } from 'vitest';

import { AnalyticsRollupService, resolveRollupDate } from './analytics-rollup.service';

describe('AnalyticsRollupService', () => {
  it('calculates and upserts one tenant/date rollup', async () => {
    const repository = createRepository({ action: 'created' });
    const service = new AnalyticsRollupService(repository as never);

    await expect(
      service.run({ tenantId: 'tenant-a', date: '2026-05-26' }),
    ).resolves.toEqual({
      tenantId: 'tenant-a',
      date: '2026-05-26',
      action: 'created',
    });

    expect(repository.calculateDailyRollupInput).toHaveBeenCalledWith(
      'tenant-a',
      new Date('2026-05-26T00:00:00.000Z'),
    );
    expect(repository.upsertDailyRollup).toHaveBeenCalledWith(
      'tenant-a',
      new Date('2026-05-26T00:00:00.000Z'),
      sampleRollup,
    );
  });

  it('is idempotent by updating the same tenant/date row on repeated runs', async () => {
    const repository = createRepository({ action: 'created' });
    repository.upsertDailyRollup.mockResolvedValueOnce('created').mockResolvedValueOnce('updated');
    const service = new AnalyticsRollupService(repository as never);

    await service.run({ tenantId: 'tenant-a', date: '2026-05-26' });
    await expect(service.run({ tenantId: 'tenant-a', date: '2026-05-26' })).resolves.toMatchObject({
      action: 'updated',
    });

    expect(repository.upsertDailyRollup).toHaveBeenCalledTimes(2);
    expect(repository.upsertDailyRollup.mock.calls.every((call) => call[0] === 'tenant-a')).toBe(true);
    expect(
      repository.upsertDailyRollup.mock.calls.every(
        (call) => (call[1] as Date).toISOString() === '2026-05-26T00:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('rejects invalid date input', async () => {
    const service = new AnalyticsRollupService(createRepository() as never);

    await expect(service.run({ tenantId: 'tenant-a', date: 'not-a-date' })).rejects.toThrow(
      'ANALYTICS_ROLLUP_DATE_INVALID',
    );
  });

  it('requires tenantId', async () => {
    const service = new AnalyticsRollupService(createRepository() as never);

    await expect(service.run({ tenantId: '' })).rejects.toThrow('ANALYTICS_ROLLUP_TENANT_ID_REQUIRED');
  });

  it('does not touch other tenants for a tenant/date job', async () => {
    const repository = createRepository();
    const service = new AnalyticsRollupService(repository as never);

    await service.run({ tenantId: 'tenant-b', date: '2026-05-26' });

    expect(repository.calculateDailyRollupInput).toHaveBeenCalledWith(
      'tenant-b',
      new Date('2026-05-26T00:00:00.000Z'),
    );
    expect(repository.calculateDailyRollupInput).not.toHaveBeenCalledWith(
      'tenant-a',
      expect.any(Date),
    );
  });

  it('defaults omitted date to yesterday UTC', () => {
    expect(resolveRollupDate(undefined, new Date('2026-05-27T13:30:00.000Z'))).toEqual(
      new Date('2026-05-26T00:00:00.000Z'),
    );
  });
});

const sampleRollup = {
  openedCount: 1,
  resolvedCount: 2,
  closedCount: 3,
  publicCommentCount: 4,
  internalNoteCount: 5,
  firstResponseSlaBreachCount: 6,
  resolutionSlaBreachCount: 7,
  avgFirstResponseSeconds: 60,
  avgResolutionSeconds: 120,
};

function createRepository(options: { action?: 'created' | 'updated' } = {}) {
  return {
    calculateDailyRollupInput: vi.fn().mockResolvedValue(sampleRollup),
    upsertDailyRollup: vi.fn().mockResolvedValue(options.action ?? 'updated'),
  };
}
