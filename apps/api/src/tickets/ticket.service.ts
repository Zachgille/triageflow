import { Inject, Injectable } from '@nestjs/common';

import type { RequestContext } from '../tenant-context/request-context';
import { InvalidTicketStatusTransitionError, TicketNotFoundError } from './ticket.errors';
import { TicketRepository } from './ticket.repository';
import type {
  CreateTicketInput,
  TicketPrismaClient,
  TicketListFilters,
  TicketListPage,
  TicketRecord,
  TicketStatus,
  UpdateTicketInput,
} from './ticket.types';

const allowedStatusTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  NEW: ['OPEN'],
  OPEN: ['PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED'],
  PENDING_CUSTOMER: ['OPEN'],
  PENDING_INTERNAL: ['OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

@Injectable()
export class TicketService {
  constructor(@Inject(TicketRepository) private readonly tickets: TicketRepository) {}

  listTickets(
    ctx: RequestContext,
    filters: TicketListFilters = {},
    client?: TicketPrismaClient,
  ): Promise<TicketListPage> {
    return this.tickets.findMany(ctx, filters, client);
  }

  async getTicket(ctx: RequestContext, ticketId: string, client?: TicketPrismaClient): Promise<TicketRecord> {
    const ticket = await this.tickets.findById(ctx, ticketId, client);

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    return ticket;
  }

  createTicket(
    ctx: RequestContext,
    input: CreateTicketInput,
    client?: TicketPrismaClient,
  ): Promise<TicketRecord> {
    return this.tickets.create(ctx, input, client);
  }

  async updateTicket(
    ctx: RequestContext,
    ticketId: string,
    input: UpdateTicketInput,
    client?: TicketPrismaClient,
  ): Promise<TicketRecord> {
    const ticket = await this.tickets.updateFields(ctx, ticketId, input, client);

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    return ticket;
  }

  async transitionTicket(
    ctx: RequestContext,
    ticketId: string,
    nextStatus: TicketStatus,
    client?: TicketPrismaClient,
  ): Promise<TicketRecord> {
    const ticket = await this.tickets.findById(ctx, ticketId, client);

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    if (!this.canTransition(ticket.status, nextStatus)) {
      throw new InvalidTicketStatusTransitionError(ticket.status, nextStatus);
    }

    const updatedTicket = await this.tickets.transitionStatus(ctx, ticketId, nextStatus, client);

    if (!updatedTicket) {
      throw new TicketNotFoundError(ticketId);
    }

    return updatedTicket;
  }

  async assignTicket(
    ctx: RequestContext,
    ticketId: string,
    assigneeUserId: string | null,
    client?: TicketPrismaClient,
  ): Promise<TicketRecord> {
    const ticket = await this.tickets.assign(ctx, ticketId, assigneeUserId, client);

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    return ticket;
  }

  async markFirstRespondedAtIfUnset(
    ctx: RequestContext,
    ticketId: string,
    firstRespondedAt: Date,
    client?: TicketPrismaClient,
  ): Promise<TicketRecord> {
    const ticket = await this.tickets.markFirstRespondedAtIfUnset(
      ctx,
      ticketId,
      firstRespondedAt,
      client,
    );

    if (!ticket) {
      throw new TicketNotFoundError(ticketId);
    }

    return ticket;
  }

  private canTransition(currentStatus: TicketStatus, nextStatus: TicketStatus) {
    return allowedStatusTransitions[currentStatus].includes(nextStatus);
  }
}
