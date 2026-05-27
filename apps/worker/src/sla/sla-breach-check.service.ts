import { Inject, Injectable, Logger } from '@nestjs/common';

import { SlaBreachRepository } from './sla-breach.repository';
import type {
  SlaBreachCandidate,
  SlaBreachCheckOptions,
  SlaBreachCheckResult,
  SlaTicketSnapshot,
} from './sla-breach.types';

@Injectable()
export class SlaBreachCheckService {
  private readonly logger = new Logger(SlaBreachCheckService.name);

  constructor(@Inject(SlaBreachRepository) private readonly repository: SlaBreachRepository) {}

  async run(options: SlaBreachCheckOptions = {}): Promise<SlaBreachCheckResult> {
    const now = options.now ?? new Date();
    const tickets = await this.repository.findTicketsWithPotentialSlaBreaches(
      now,
      options.limit,
      options.tenantId,
    );
    let createdBreaches = 0;
    let existingBreaches = 0;

    for (const ticket of tickets) {
      const breaches = determineBreaches(ticket, now);

      for (const breach of breaches) {
        const result = await this.repository.createBreachIfMissing(breach);

        if (result === 'created') {
          createdBreaches += 1;
        } else {
          existingBreaches += 1;
        }
      }
    }

    const result = {
      scannedTickets: tickets.length,
      createdBreaches,
      existingBreaches,
    };

    this.logger.log(
      `SLA breach check scanned ${result.scannedTickets} tickets, created ${result.createdBreaches} breaches, found ${result.existingBreaches} existing breaches.`,
    );

    return result;
  }
}

function determineBreaches(ticket: SlaTicketSnapshot, now: Date): SlaBreachCandidate[] {
  const breaches: SlaBreachCandidate[] = [];

  if (
    ticket.firstResponseDueAt &&
    now.getTime() > ticket.firstResponseDueAt.getTime() &&
    !ticket.firstRespondedAt
  ) {
    breaches.push({
      tenantId: ticket.tenantId,
      ticketId: ticket.id,
      breachType: 'first_response',
      breachedAt: ticket.firstResponseDueAt,
    });
  }

  if (ticket.resolutionDueAt && now.getTime() > ticket.resolutionDueAt.getTime() && !ticket.resolvedAt) {
    breaches.push({
      tenantId: ticket.tenantId,
      ticketId: ticket.id,
      breachType: 'resolution',
      breachedAt: ticket.resolutionDueAt,
    });
  }

  return breaches;
}
