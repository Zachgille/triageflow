import { describe, expect, it, vi } from 'vitest';

import {
  InvalidTicketStatusTransitionError,
  TicketNotFoundError,
} from './ticket.errors';
import { TicketRepository } from './ticket.repository';
import { TicketService } from './ticket.service';
import type { TicketRecord, TicketStatus } from './ticket.types';
import { makeTicketWithStatus, tenantAContext } from './ticket.test-helpers';

type MockTicketRepository = Pick<
  TicketRepository,
  | 'findMany'
  | 'findById'
  | 'create'
  | 'updateFields'
  | 'transitionStatus'
  | 'assign'
  | 'markFirstRespondedAtIfUnset'
>;

function createMockRepository(ticket: TicketRecord | null): MockTicketRepository {
  return {
    findMany: vi.fn(),
    findById: vi.fn().mockResolvedValue(ticket),
    create: vi.fn(),
    updateFields: vi.fn(),
    transitionStatus: vi.fn((_ctx, _ticketId, nextStatus: TicketStatus) =>
      Promise.resolve(ticket ? { ...ticket, status: nextStatus } : null),
    ),
    assign: vi.fn(),
    markFirstRespondedAtIfUnset: vi.fn(),
  };
}

describe('TicketService status transitions', () => {
  const validTransitions: Array<[TicketStatus, TicketStatus]> = [
    ['NEW', 'OPEN'],
    ['OPEN', 'PENDING_CUSTOMER'],
    ['OPEN', 'PENDING_INTERNAL'],
    ['OPEN', 'RESOLVED'],
    ['PENDING_CUSTOMER', 'OPEN'],
    ['PENDING_INTERNAL', 'OPEN'],
    ['RESOLVED', 'CLOSED'],
    ['RESOLVED', 'OPEN'],
    ['CLOSED', 'OPEN'],
  ];

  it.each(validTransitions)('allows %s -> %s', async (currentStatus, nextStatus) => {
    const repository = createMockRepository(makeTicketWithStatus(currentStatus));
    const service = new TicketService(repository as TicketRepository);

    await expect(service.transitionTicket(tenantAContext, 'ticket-a', nextStatus)).resolves.toMatchObject({
      status: nextStatus,
    });
  });

  const invalidTransitions: Array<[TicketStatus, TicketStatus]> = [
    ['NEW', 'CLOSED'],
    ['OPEN', 'CLOSED'],
    ['CLOSED', 'RESOLVED'],
  ];

  it.each(invalidTransitions)('rejects %s -> %s', async (currentStatus, nextStatus) => {
    const repository = createMockRepository(makeTicketWithStatus(currentStatus));
    const service = new TicketService(repository as TicketRepository);

    await expect(service.transitionTicket(tenantAContext, 'ticket-a', nextStatus)).rejects.toBeInstanceOf(
      InvalidTicketStatusTransitionError,
    );
  });

  it('represents not found tickets with a typed domain error', async () => {
    const repository = createMockRepository(null);
    const service = new TicketService(repository as TicketRepository);

    await expect(service.getTicket(tenantAContext, 'missing-ticket')).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it('treats another tenant ticket as not found through the current tenant context', async () => {
    const repository = createMockRepository(null);
    const service = new TicketService(repository as TicketRepository);

    await expect(service.transitionTicket(tenantAContext, 'tenant-b-ticket', 'OPEN')).rejects.toBeInstanceOf(
      TicketNotFoundError,
    );
  });
});
