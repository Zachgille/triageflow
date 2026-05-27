import type { Prisma } from '@triageflow/db';

export type AnalyticsDailyRollupInput = {
  openedCount: number;
  resolvedCount: number;
  closedCount: number;
  publicCommentCount: number;
  internalNoteCount: number;
  firstResponseSlaBreachCount: number;
  resolutionSlaBreachCount: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
};

export type AnalyticsOverview = {
  openTicketCount: number;
  newTicketCount: number;
  pendingTicketCount: number;
  resolvedTicketCount: number;
  closedTicketCount: number;
  totalSlaBreachCount: number;
  unresolvedSlaBreachCount: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
};

export type AnalyticsDailyRollupRecord = Prisma.AnalyticsDailyRollupGetPayload<object>;

export type AnalyticsPrismaClient = Pick<
  Prisma.TransactionClient,
  'analyticsDailyRollup' | 'ticket' | 'ticketComment' | 'slaBreach'
>;
