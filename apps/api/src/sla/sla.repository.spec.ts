import { Prisma } from '@triageflow/db';
import { describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../tenant-context/request-context';
import { SlaRepository } from './sla.repository';

const tenantAId = '11111111-1111-4111-8111-111111111111';
const tenantBId = '22222222-2222-4222-8222-222222222222';
const ticketAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

type MockBreachType = 'FIRST_RESPONSE' | 'RESOLUTION';

type MockBreachCreateArgs = {
  data: {
    tenantId: string;
    ticketId: string;
    breachType: MockBreachType;
    breachedAt: Date;
    metadata: unknown;
  };
};

type MockBreachFindUniqueArgs = {
  where: {
    tenantId_ticketId_breachType: {
      tenantId: string;
      ticketId: string;
      breachType: MockBreachType;
    };
  };
};

describe('SlaRepository', () => {
  it('looks up policies by tenant and priority', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaRepository(prisma);

    const result = await repository.findPolicyForTicket(requestContext(tenantAId), 'HIGH');

    expect(result).toMatchObject({ tenantId: tenantAId, priority: 'HIGH' });
    expect(prisma.slaPolicy.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_priority: {
          tenantId: tenantAId,
          priority: 'HIGH',
        },
      },
    });
  });

  it('does not leak policies across tenants', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaRepository(prisma);

    const result = await repository.findPolicyForTicket(requestContext(tenantBId), 'HIGH');

    expect(result).toBeNull();
  });

  it('creates tenant-scoped breach records', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaRepository(prisma);
    const breachedAt = new Date('2026-05-26T12:30:00.000Z');

    const breach = await repository.createBreach(requestContext(tenantAId), {
      ticketId: ticketAId,
      breachType: 'first_response',
      breachedAt,
      metadata: { source: 'unit-test' },
    });

    expect(breach).toMatchObject({
      tenantId: tenantAId,
      ticketId: ticketAId,
      breachType: 'FIRST_RESPONSE',
      breachedAt,
      metadata: { source: 'unit-test' },
    });
  });

  it('returns existing breach on duplicate unique constraint for idempotency', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaRepository(prisma);
    const input = {
      ticketId: ticketAId,
      breachType: 'resolution' as const,
      breachedAt: new Date('2026-05-26T20:00:00.000Z'),
    };

    const first = await repository.createBreach(requestContext(tenantAId), input);
    const second = await repository.createBreach(requestContext(tenantAId), input);

    expect(second).toEqual(first);
    expect(prisma.slaBreach.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_ticketId_breachType: {
          tenantId: tenantAId,
          ticketId: ticketAId,
          breachType: 'RESOLUTION',
        },
      },
    });
  });
});

function createMockPrisma() {
  const policies = [
    {
      id: 'policy-a-high',
      tenantId: tenantAId,
      name: 'High',
      priority: 'HIGH',
      firstResponseMinutes: 120,
      resolutionMinutes: 1440,
      isDefault: true,
      createdAt: new Date('2026-05-26T12:00:00.000Z'),
      updatedAt: new Date('2026-05-26T12:00:00.000Z'),
    },
  ];
  const breaches: Array<{
    id: string;
    tenantId: string;
    ticketId: string;
    breachType: MockBreachType;
    breachedAt: Date;
    acknowledgedAt: Date | null;
    metadata: unknown;
    createdAt: Date;
  }> = [];

  return {
    slaPolicy: {
      findUnique: vi.fn(({ where }: { where: { tenantId_priority: { tenantId: string; priority: string } } }) => {
        return (
          policies.find(
            (policy) =>
              policy.tenantId === where.tenantId_priority.tenantId &&
              policy.priority === where.tenantId_priority.priority,
          ) ?? null
        );
      }),
    },
    slaBreach: {
      create: vi.fn(({ data }: MockBreachCreateArgs) => {
        const existing = breaches.find(
          (breach) =>
            breach.tenantId === data.tenantId &&
            breach.ticketId === data.ticketId &&
            breach.breachType === data.breachType,
        );

        if (existing) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            clientVersion: 'unit-test',
            code: 'P2002',
          });
        }

        const breach = {
          id: `breach-${breaches.length + 1}`,
          tenantId: data.tenantId,
          ticketId: data.ticketId,
          breachType: data.breachType,
          breachedAt: data.breachedAt,
          acknowledgedAt: null,
          metadata: data.metadata,
          createdAt: new Date('2026-05-26T12:00:00.000Z'),
        };
        breaches.push(breach);
        return breach;
      }),
      findUnique: vi.fn(({ where }: MockBreachFindUniqueArgs) => {
        return (
          breaches.find(
            (breach) =>
              breach.tenantId === where.tenantId_ticketId_breachType.tenantId &&
              breach.ticketId === where.tenantId_ticketId_breachType.ticketId &&
              breach.breachType === where.tenantId_ticketId_breachType.breachType,
          ) ?? null
        );
      }),
    },
  } as unknown as ConstructorParameters<typeof SlaRepository>[0] & {
    slaPolicy: { findUnique: ReturnType<typeof vi.fn> };
    slaBreach: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  };
}

function requestContext(tenantId: string): RequestContext {
  return {
    requestId: 'request-1',
    userId: 'user-1',
    tenantId,
    membershipId: 'membership-1',
    permissions: [],
  };
}
