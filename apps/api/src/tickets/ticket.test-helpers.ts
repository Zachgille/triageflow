import type { RequestContext } from '../tenant-context/request-context';
import type { TicketRecord, TicketStatus } from './ticket.types';

export const tenantAContext: RequestContext = {
  requestId: 'request-a',
  userId: 'admin-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-a',
  permissions: ['tickets.read', 'tickets.write'],
};

export const tenantBContext: RequestContext = {
  requestId: 'request-b',
  userId: 'admin-b',
  tenantId: 'tenant-b',
  membershipId: 'membership-b',
  permissions: ['tickets.read', 'tickets.write'],
};

export function makeTicket(overrides: Partial<TicketRecord> = {}): TicketRecord {
  const now = new Date('2026-05-26T12:00:00.000Z');

  return {
    id: 'ticket-a',
    tenantId: 'tenant-a',
    requesterId: 'requester-a',
    assigneeUserId: null,
    status: 'NEW',
    priority: 'NORMAL',
    subject: 'Need help',
    description: 'The customer needs help.',
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeTicketWithStatus(status: TicketStatus): TicketRecord {
  return makeTicket({ status });
}
