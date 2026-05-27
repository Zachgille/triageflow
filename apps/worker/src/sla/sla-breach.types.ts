import type { Prisma } from '@triageflow/db';

export type SlaBreachType = 'first_response' | 'resolution';

export type SlaBreachCheckJobData = {
  tenantId?: string;
  limit?: number;
  now?: string;
};

export type SlaBreachCheckOptions = {
  tenantId?: string;
  limit?: number;
  now?: Date;
};

export type SlaBreachCheckResult = {
  scannedTickets: number;
  createdBreaches: number;
  existingBreaches: number;
};

export type SlaQueueStatus = {
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  repeatableJobs: Array<{
    id: string;
    name: string;
    next: number | undefined;
    every: number | undefined;
    pattern: string | undefined;
  }>;
};

export type SlaBreachCandidate = {
  tenantId: string;
  ticketId: string;
  breachType: SlaBreachType;
  breachedAt: Date;
};

export type SlaTicketSnapshot = Prisma.TicketGetPayload<object>;
