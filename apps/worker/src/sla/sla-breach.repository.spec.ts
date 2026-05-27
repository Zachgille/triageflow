import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import { SlaBreachRepository } from './sla-breach.repository';

describe('SlaBreachRepository', () => {
  it('queries potential SLA breaches with tenant filter and bounded limit', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaBreachRepository(prisma as unknown as PrismaService);
    const now = new Date('2026-05-26T12:00:00.000Z');

    await repository.findTicketsWithPotentialSlaBreaches(now, 25, 'tenant-a');

    expect(prisma.ticket.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        OR: [
          {
            firstResponseDueAt: { lt: now },
            firstRespondedAt: null,
          },
          {
            resolutionDueAt: { lt: now },
            resolvedAt: null,
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
  });

  it('caps oversized batch limits', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaBreachRepository(prisma as unknown as PrismaService);

    await repository.findTicketsWithPotentialSlaBreaches(new Date(), 10_000);

    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
      }),
    );
  });

  it('creates breach records with worker idempotency keys', async () => {
    const prisma = createMockPrisma();
    const repository = new SlaBreachRepository(prisma as unknown as PrismaService);
    const breachedAt = new Date('2026-05-26T11:00:00.000Z');

    await expect(
      repository.createBreachIfMissing({
        tenantId: 'tenant-a',
        ticketId: 'ticket-a',
        breachType: 'first_response',
        breachedAt,
      }),
    ).resolves.toBe('created');
    expect(prisma.slaBreach.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-a',
        ticketId: 'ticket-a',
        breachType: 'FIRST_RESPONSE',
        breachedAt,
        metadata: {},
      },
    });
  });

  it('treats duplicate unique-constraint conflicts idempotently', async () => {
    const prisma = createMockPrisma();
    prisma.slaBreach.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const repository = new SlaBreachRepository(prisma as unknown as PrismaService);

    await expect(
      repository.createBreachIfMissing({
        tenantId: 'tenant-a',
        ticketId: 'ticket-a',
        breachType: 'resolution',
        breachedAt: new Date('2026-05-26T11:00:00.000Z'),
      }),
    ).resolves.toBe('existing');
  });
});

function createMockPrisma() {
  return {
    ticket: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    slaBreach: {
      create: vi.fn().mockResolvedValue({ id: 'breach-a' }),
    },
  };
}
