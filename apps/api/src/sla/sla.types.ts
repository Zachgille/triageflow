import type { Prisma } from '@triageflow/db';

import type { TicketPriority } from '../tickets/ticket.types';

export const slaBreachTypes = ['first_response', 'resolution'] as const;

export type SlaBreachType = (typeof slaBreachTypes)[number];

export type SlaPolicyRecord = Prisma.SlaPolicyGetPayload<object>;

export type SlaBreachRecord = Prisma.SlaBreachGetPayload<object>;

export type SlaPrismaClient = Pick<Prisma.TransactionClient, 'slaPolicy' | 'slaBreach'>;

export type SlaTicketSnapshot = {
  id: string;
  tenantId: string;
  priority: TicketPriority;
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
};

export type CalculatedSlaDeadlines = {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
};

export type SlaBreachCandidate = {
  breachType: SlaBreachType;
  breachedAt: Date;
};

export type CreateSlaBreachInput = {
  ticketId: string;
  breachType: SlaBreachType;
  breachedAt: Date;
  metadata?: Prisma.InputJsonValue;
};
