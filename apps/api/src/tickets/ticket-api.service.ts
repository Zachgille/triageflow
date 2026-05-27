import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@triageflow/db';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { SlaService } from '../sla/sla.service';
import type { RequestContext } from '../tenant-context/request-context';
import { TicketSlaPolicyNotFoundError } from './ticket.errors';
import { TicketService } from './ticket.service';
import type {
  CreateTicketInput,
  TicketListFilters,
  TicketRecord,
  TicketStatus,
  UpdateTicketInput,
} from './ticket.types';

@Injectable()
export class TicketApiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TicketService) private readonly tickets: TicketService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SlaService) private readonly sla: SlaService,
  ) {}

  listTickets(ctx: RequestContext, filters: TicketListFilters) {
    return this.tickets.listTickets(ctx, filters);
  }

  getTicket(ctx: RequestContext, ticketId: string) {
    return this.tickets.getTicket(ctx, ticketId);
  }

  createTicket(ctx: RequestContext, input: CreateTicketInput) {
    return this.prisma.$transaction(async (tx) => {
      const priority = input.priority ?? 'NORMAL';
      const policy = await this.sla.findPolicyForTicket(ctx, priority, tx);

      if (!policy) {
        throw new TicketSlaPolicyNotFoundError(priority);
      }

      const createdAt = new Date();
      const deadlines = this.sla.calculateDeadlines(createdAt, policy);
      const ticket = await this.tickets.createTicket(
        ctx,
        {
          ...input,
          priority,
          createdAt,
          firstResponseDueAt: deadlines.firstResponseDueAt,
          resolutionDueAt: deadlines.resolutionDueAt,
        },
        tx,
      );

      await this.audit.record(
        ctx,
        {
          entityType: 'ticket',
          entityId: ticket.id,
          action: 'ticket.created',
          after: toAuditJson(ticket),
          metadata: { changedFields: Object.keys(input) },
        },
        tx,
      );

      return ticket;
    });
  }

  updateTicket(ctx: RequestContext, ticketId: string, input: UpdateTicketInput) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.tickets.getTicket(ctx, ticketId, tx);
      const after = await this.tickets.updateTicket(ctx, ticketId, input, tx);
      const priorityChanged = input.priority !== undefined && input.priority !== before.priority;

      await this.audit.record(
        ctx,
        {
          entityType: 'ticket',
          entityId: after.id,
          action: priorityChanged ? 'ticket.priority_changed' : 'ticket.updated',
          before: toAuditJson(before),
          after: toAuditJson(after),
          metadata: {
            changedFields: Object.keys(input),
            ...(priorityChanged
              ? { fromPriority: before.priority, toPriority: after.priority }
              : {}),
          },
        },
        tx,
      );

      return after;
    });
  }

  transitionTicket(ctx: RequestContext, ticketId: string, nextStatus: TicketStatus) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.tickets.getTicket(ctx, ticketId, tx);
      const after = await this.tickets.transitionTicket(ctx, ticketId, nextStatus, tx);

      await this.audit.record(
        ctx,
        {
          entityType: 'ticket',
          entityId: after.id,
          action: 'ticket.status_changed',
          before: toAuditJson(before),
          after: toAuditJson(after),
          metadata: {
            fromStatus: before.status,
            toStatus: after.status,
          },
        },
        tx,
      );

      return after;
    });
  }

  assignTicket(ctx: RequestContext, ticketId: string, assigneeUserId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.tickets.getTicket(ctx, ticketId, tx);
      const after = await this.tickets.assignTicket(ctx, ticketId, assigneeUserId, tx);

      await this.audit.record(
        ctx,
        {
          entityType: 'ticket',
          entityId: after.id,
          action: 'ticket.assigned',
          before: toAuditJson(before),
          after: toAuditJson(after),
          metadata: {
            fromAssigneeUserId: before.assigneeUserId,
            toAssigneeUserId: after.assigneeUserId,
          },
        },
        tx,
      );

      return after;
    });
  }
}

function toAuditJson(ticket: TicketRecord): Prisma.InputJsonValue {
  return {
    id: ticket.id,
    tenantId: ticket.tenantId,
    requesterId: ticket.requesterId,
    assigneeUserId: ticket.assigneeUserId,
    status: ticket.status,
    priority: ticket.priority,
    subject: ticket.subject,
    description: ticket.description,
    firstResponseDueAt: ticket.firstResponseDueAt?.toISOString() ?? null,
    resolutionDueAt: ticket.resolutionDueAt?.toISOString() ?? null,
    firstRespondedAt: ticket.firstRespondedAt?.toISOString() ?? null,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
