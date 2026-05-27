import type { TicketStatus } from './ticket.types';

export class TicketDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export class TicketNotFoundError extends TicketDomainError {
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} was not found.`, 'TICKET_NOT_FOUND');
  }
}

export class InvalidTicketStatusTransitionError extends TicketDomainError {
  constructor(currentStatus: TicketStatus, nextStatus: TicketStatus) {
    super(
      `Ticket cannot transition from ${currentStatus} to ${nextStatus}.`,
      'INVALID_TICKET_STATUS_TRANSITION',
    );
  }
}

export class TicketTenantConstraintError extends TicketDomainError {
  constructor(message: string) {
    super(message, 'TICKET_TENANT_CONSTRAINT');
  }
}

export class TicketSlaPolicyNotFoundError extends TicketDomainError {
  constructor(priority: string) {
    super(`No SLA policy is configured for ticket priority ${priority}.`, 'SLA_POLICY_NOT_FOUND');
  }
}

export class RequestContextRequiredError extends TicketDomainError {
  constructor() {
    super('RequestContext is required for ticket repository operations.', 'REQUEST_CONTEXT_REQUIRED');
  }
}
