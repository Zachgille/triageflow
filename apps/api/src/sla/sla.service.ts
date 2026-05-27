import { Inject, Injectable } from '@nestjs/common';

import type { RequestContext } from '../tenant-context/request-context';
import type { TicketPriority } from '../tickets/ticket.types';
import { SlaRepository } from './sla.repository';
import type {
  CalculatedSlaDeadlines,
  CreateSlaBreachInput,
  SlaBreachCandidate,
  SlaPrismaClient,
  SlaPolicyRecord,
  SlaTicketSnapshot,
} from './sla.types';

@Injectable()
export class SlaService {
  constructor(@Inject(SlaRepository) private readonly repository: SlaRepository) {}

  findPolicyForTicket(ctx: RequestContext, ticketPriority: TicketPriority, client?: SlaPrismaClient) {
    return this.repository.findPolicyForTicket(ctx, ticketPriority, client);
  }

  calculateDeadlines(createdAt: Date, policy: Pick<SlaPolicyRecord, 'firstResponseMinutes' | 'resolutionMinutes'>): CalculatedSlaDeadlines {
    return {
      firstResponseDueAt: this.calculateFirstResponseDueAt(createdAt, policy),
      resolutionDueAt: this.calculateResolutionDueAt(createdAt, policy),
    };
  }

  calculateFirstResponseDueAt(createdAt: Date, policy: Pick<SlaPolicyRecord, 'firstResponseMinutes'>) {
    return addMinutes(createdAt, policy.firstResponseMinutes);
  }

  calculateResolutionDueAt(createdAt: Date, policy: Pick<SlaPolicyRecord, 'resolutionMinutes'>) {
    return addMinutes(createdAt, policy.resolutionMinutes);
  }

  determineFirstResponseSatisfied(ticket: Pick<SlaTicketSnapshot, 'firstRespondedAt'>) {
    return ticket.firstRespondedAt !== null;
  }

  determineResolutionSatisfied(ticket: Pick<SlaTicketSnapshot, 'resolvedAt'>) {
    return ticket.resolvedAt !== null;
  }

  determineBreaches(ticket: SlaTicketSnapshot, now: Date): SlaBreachCandidate[] {
    const breaches: SlaBreachCandidate[] = [];

    if (
      ticket.firstResponseDueAt &&
      now.getTime() > ticket.firstResponseDueAt.getTime() &&
      !this.determineFirstResponseSatisfied(ticket)
    ) {
      breaches.push({
        breachType: 'first_response',
        breachedAt: ticket.firstResponseDueAt,
      });
    }

    if (
      ticket.resolutionDueAt &&
      now.getTime() > ticket.resolutionDueAt.getTime() &&
      !this.determineResolutionSatisfied(ticket)
    ) {
      breaches.push({
        breachType: 'resolution',
        breachedAt: ticket.resolutionDueAt,
      });
    }

    return breaches;
  }

  createBreach(ctx: RequestContext, input: CreateSlaBreachInput) {
    return this.repository.createBreach(ctx, input);
  }
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}
