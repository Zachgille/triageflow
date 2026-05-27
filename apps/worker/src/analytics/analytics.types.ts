import type { Prisma } from '@triageflow/db';

export type AnalyticsRollupDailyJobData = {
  tenantId?: string;
  date?: string;
  now?: string;
};

export type AnalyticsScheduleDailyRollupsJobData = {
  date?: string;
  now?: string;
  limit?: number;
};

export type AnalyticsJobData = AnalyticsRollupDailyJobData | AnalyticsScheduleDailyRollupsJobData;

export type AnalyticsRollupOptions = {
  tenantId: string;
  date?: Date | string;
  now?: Date;
};

export type AnalyticsRollupResult = {
  tenantId: string;
  date: string;
  action: 'created' | 'updated';
};

export type AnalyticsScheduleDailyRollupsResult = {
  date: string;
  tenantBatchSize: number;
  loadedTenants: number;
  enqueuedRollupJobs: number;
  skippedDuplicateJobs: number;
};

export type AnalyticsJobResult = AnalyticsRollupResult | AnalyticsScheduleDailyRollupsResult;

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

export type AnalyticsPrismaClient = Pick<
  Prisma.TransactionClient,
  'analyticsDailyRollup' | 'ticket' | 'ticketComment' | 'slaBreach' | 'tenant'
>;

export type QueueStatus = {
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
