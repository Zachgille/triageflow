import { describe, expect, it, vi } from 'vitest';

import { SlaRepository } from './sla.repository';
import { SlaService } from './sla.service';
import type { SlaPolicyRecord, SlaTicketSnapshot } from './sla.types';

const createdAt = new Date('2026-05-26T12:00:00.000Z');

describe('SlaService calculations', () => {
  const service = new SlaService({} as SlaRepository);

  it.each([
    ['LOW', 1440, 10080, '2026-05-27T12:00:00.000Z', '2026-06-02T12:00:00.000Z'],
    ['NORMAL', 480, 4320, '2026-05-26T20:00:00.000Z', '2026-05-29T12:00:00.000Z'],
    ['HIGH', 120, 1440, '2026-05-26T14:00:00.000Z', '2026-05-27T12:00:00.000Z'],
    ['URGENT', 30, 480, '2026-05-26T12:30:00.000Z', '2026-05-26T20:00:00.000Z'],
  ])(
    'calculates %s policy deadlines with 24/7 elapsed-time math',
    (_, firstResponseMinutes, resolutionMinutes, expectedFirstResponse, expectedResolution) => {
      const deadlines = service.calculateDeadlines(createdAt, policy({ firstResponseMinutes, resolutionMinutes }));

      expect(deadlines.firstResponseDueAt.toISOString()).toBe(expectedFirstResponse);
      expect(deadlines.resolutionDueAt.toISOString()).toBe(expectedResolution);
    },
  );

  it('calculates first-response deadline independently', () => {
    expect(service.calculateFirstResponseDueAt(createdAt, policy({ firstResponseMinutes: 15 })).toISOString()).toBe(
      '2026-05-26T12:15:00.000Z',
    );
  });

  it('calculates resolution deadline independently', () => {
    expect(service.calculateResolutionDueAt(createdAt, policy({ resolutionMinutes: 90 })).toISOString()).toBe(
      '2026-05-26T13:30:00.000Z',
    );
  });

  it('marks first response satisfied when firstRespondedAt is present', () => {
    expect(service.determineFirstResponseSatisfied(ticket({ firstRespondedAt: new Date('2026-05-26T12:10:00.000Z') }))).toBe(
      true,
    );
  });

  it('marks resolution satisfied when resolvedAt is present', () => {
    expect(service.determineResolutionSatisfied(ticket({ resolvedAt: new Date('2026-05-26T13:00:00.000Z') }))).toBe(
      true,
    );
  });

  it('detects first-response breach after due time when no first response exists', () => {
    expect(
      service.determineBreaches(
        ticket({ firstResponseDueAt: new Date('2026-05-26T12:30:00.000Z') }),
        new Date('2026-05-26T12:31:00.000Z'),
      ),
    ).toEqual([{ breachType: 'first_response', breachedAt: new Date('2026-05-26T12:30:00.000Z') }]);
  });

  it('detects resolution breach after due time when unresolved', () => {
    expect(
      service.determineBreaches(
        ticket({ resolutionDueAt: new Date('2026-05-26T20:00:00.000Z') }),
        new Date('2026-05-26T20:01:00.000Z'),
      ),
    ).toEqual([{ breachType: 'resolution', breachedAt: new Date('2026-05-26T20:00:00.000Z') }]);
  });

  it('does not detect breaches before deadlines pass', () => {
    expect(
      service.determineBreaches(
        ticket({
          firstResponseDueAt: new Date('2026-05-26T12:30:00.000Z'),
          resolutionDueAt: new Date('2026-05-26T20:00:00.000Z'),
        }),
        new Date('2026-05-26T12:29:59.000Z'),
      ),
    ).toEqual([]);
  });

  it('delegates tenant-scoped policy lookup to repository', async () => {
    const findPolicyForTicket = vi.fn().mockResolvedValue(policy({ firstResponseMinutes: 30, resolutionMinutes: 480 }));
    const repository = {
      findPolicyForTicket,
    } as unknown as SlaRepository;
    const delegatedService = new SlaService(repository);
    const ctx = requestContext('tenant-a');

    await delegatedService.findPolicyForTicket(ctx, 'URGENT');

    expect(findPolicyForTicket).toHaveBeenCalledWith(ctx, 'URGENT', undefined);
  });
});

function policy(overrides: Partial<SlaPolicyRecord> = {}): SlaPolicyRecord {
  return {
    id: 'policy-1',
    tenantId: 'tenant-a',
    name: 'Urgent policy',
    priority: 'URGENT',
    firstResponseMinutes: 30,
    resolutionMinutes: 480,
    isDefault: true,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function ticket(overrides: Partial<SlaTicketSnapshot> = {}): SlaTicketSnapshot {
  return {
    id: 'ticket-1',
    tenantId: 'tenant-a',
    priority: 'URGENT',
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

function requestContext(tenantId: string) {
  return {
    requestId: 'request-1',
    userId: 'user-1',
    tenantId,
    membershipId: 'membership-1',
    permissions: [],
  };
}
