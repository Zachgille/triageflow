import { describe, expect, it, vi } from 'vitest';

import { SlaBreachCheckService } from './sla-breach-check.service';
import { SlaBreachRepository } from './sla-breach.repository';
import type { SlaTicketSnapshot } from './sla-breach.types';

const now = new Date('2026-05-26T12:00:00.000Z');

describe('SlaBreachCheckService', () => {
  it('creates first_response breach for overdue tickets without first_responded_at', async () => {
    const repository = createRepository([
      makeTicket({
        firstResponseDueAt: new Date('2026-05-26T11:00:00.000Z'),
        firstRespondedAt: null,
      }),
    ]);
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    const result = await service.run({ now });

    expect(result.createdBreaches).toBe(1);
    expect(repository.createBreachIfMissing).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      ticketId: 'ticket-a',
      breachType: 'first_response',
      breachedAt: new Date('2026-05-26T11:00:00.000Z'),
    });
  });

  it('does not create first_response breach when first_responded_at is set', async () => {
    const repository = createRepository([
      makeTicket({
        firstResponseDueAt: new Date('2026-05-26T11:00:00.000Z'),
        firstRespondedAt: new Date('2026-05-26T10:30:00.000Z'),
      }),
    ]);
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    const result = await service.run({ now });

    expect(result.createdBreaches).toBe(0);
    expect(repository.createBreachIfMissing).not.toHaveBeenCalled();
  });

  it('creates resolution breach for overdue tickets without resolved_at', async () => {
    const repository = createRepository([
      makeTicket({
        resolutionDueAt: new Date('2026-05-26T11:00:00.000Z'),
        resolvedAt: null,
      }),
    ]);
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    const result = await service.run({ now });

    expect(result.createdBreaches).toBe(1);
    expect(repository.createBreachIfMissing).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      ticketId: 'ticket-a',
      breachType: 'resolution',
      breachedAt: new Date('2026-05-26T11:00:00.000Z'),
    });
  });

  it('does not create resolution breach when resolved_at is set', async () => {
    const repository = createRepository([
      makeTicket({
        resolutionDueAt: new Date('2026-05-26T11:00:00.000Z'),
        resolvedAt: new Date('2026-05-26T10:30:00.000Z'),
      }),
    ]);
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    const result = await service.run({ now });

    expect(result.createdBreaches).toBe(0);
    expect(repository.createBreachIfMissing).not.toHaveBeenCalled();
  });

  it('treats repeated runs as idempotent when breaches already exist', async () => {
    const repository = createRepository([
      makeTicket({
        firstResponseDueAt: new Date('2026-05-26T11:00:00.000Z'),
      }),
    ]);
    repository.createBreachIfMissing.mockResolvedValue('existing');
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    const result = await service.run({ now });

    expect(result.createdBreaches).toBe(0);
    expect(result.existingBreaches).toBe(1);
  });

  it('passes tenantId filter and batch limit to the repository', async () => {
    const repository = createRepository([]);
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    await service.run({ now, tenantId: 'tenant-b', limit: 25 });

    expect(repository.findTicketsWithPotentialSlaBreaches).toHaveBeenCalledWith(now, 25, 'tenant-b');
  });

  it('handles no eligible tickets cleanly', async () => {
    const repository = createRepository([]);
    const service = new SlaBreachCheckService(repository as unknown as SlaBreachRepository);

    const result = await service.run({ now });

    expect(result).toEqual({
      scannedTickets: 0,
      createdBreaches: 0,
      existingBreaches: 0,
    });
  });
});

function createRepository(tickets: SlaTicketSnapshot[]) {
  return {
    findTicketsWithPotentialSlaBreaches: vi.fn().mockResolvedValue(tickets),
    createBreachIfMissing: vi.fn().mockResolvedValue('created'),
  };
}

function makeTicket(overrides: Partial<SlaTicketSnapshot> = {}): SlaTicketSnapshot {
  const createdAt = new Date('2026-05-26T09:00:00.000Z');

  return {
    id: 'ticket-a',
    tenantId: 'tenant-a',
    requesterId: 'requester-a',
    assigneeUserId: null,
    status: 'OPEN',
    priority: 'NORMAL',
    subject: 'Test ticket',
    description: 'Test description',
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}
