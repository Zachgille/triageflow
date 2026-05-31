import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from '../tenant-context/request-context';
import { AnalyticsRepository, normalizeUtcDate } from './analytics.repository';
import type { AnalyticsDailyRollupInput, AnalyticsDailyRollupRecord } from './analytics.types';

const tenantAId = '11111111-1111-4111-8111-111111111111';
const tenantBId = '22222222-2222-4222-8222-222222222222';
const targetDate = new Date('2026-05-27T13:45:00.000Z');
const normalizedDate = new Date('2026-05-27T00:00:00.000Z');

const tenantAContext: RequestContext = {
  requestId: 'request-a',
  userId: 'user-a',
  tenantId: tenantAId,
  membershipId: 'membership-a',
  permissions: [],
};

describe('AnalyticsRepository', () => {
  it('calculates daily rollup counts and averages using UTC day boundaries', async () => {
    const { repository } = createRepository();

    const rollup = await repository.calculateDailyRollupInput(tenantAId, targetDate);

    expect(rollup).toEqual({
      openedCount: 3,
      resolvedCount: 1,
      closedCount: 1,
      publicCommentCount: 1,
      internalNoteCount: 1,
      firstResponseSlaBreachCount: 1,
      resolutionSlaBreachCount: 1,
      avgFirstResponseSeconds: 1_800,
      avgResolutionSeconds: 10_800,
    });
  });

  it('uses resolved_at date rather than created_at for resolved_count', async () => {
    const { repository } = createRepository();

    const rollup = await repository.calculateDailyRollupInput(tenantAId, new Date('2026-05-26T12:00:00.000Z'));

    expect(rollup.openedCount).toBe(3);
    expect(rollup.resolvedCount).toBe(0);
  });

  it('returns zero counts and null averages for an empty UTC day', async () => {
    const { repository } = createRepository();

    const rollup = await repository.calculateDailyRollupInput(tenantAId, new Date('2026-05-29T12:00:00.000Z'));

    expect(rollup).toEqual({
      openedCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      publicCommentCount: 0,
      internalNoteCount: 0,
      firstResponseSlaBreachCount: 0,
      resolutionSlaBreachCount: 0,
      avgFirstResponseSeconds: null,
      avgResolutionSeconds: null,
    });
  });

  it('upserts daily rollups idempotently by tenant and UTC date', async () => {
    const { repository, prisma } = createRepository();
    const data = makeRollupInput({ openedCount: 3 });

    await repository.upsertDailyRollup(tenantAId, normalizedDate, data);

    expect(prisma.analyticsDailyRollup.upsert).toHaveBeenCalledWith({
      where: {
        tenantId_date: {
          tenantId: tenantAId,
          date: normalizedDate,
        },
      },
      create: {
        tenantId: tenantAId,
        date: normalizedDate,
        ...data,
      },
      update: data,
    });
  });

  it('reads daily rollups through ctx.tenantId only', async () => {
    const { repository, prisma } = createRepository();
    const from = new Date('2026-05-27T00:00:00.000Z');
    const to = new Date('2026-05-28T00:00:00.000Z');

    await repository.getDailyRollups(tenantAContext, from, to);

    expect(prisma.analyticsDailyRollup.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantAId,
        date: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        date: true,
        openedCount: true,
        resolvedCount: true,
        closedCount: true,
        publicCommentCount: true,
        internalNoteCount: true,
        firstResponseSlaBreachCount: true,
        resolutionSlaBreachCount: true,
        avgFirstResponseSeconds: true,
        avgResolutionSeconds: true,
      },
      orderBy: { date: 'asc' },
    });
  });

  it('does not return another tenant rollups', async () => {
    const { repository } = createRepository();

    const rollups = await repository.getDailyRollups(
      tenantAContext,
      new Date('2026-05-27T00:00:00.000Z'),
      new Date('2026-05-27T00:00:00.000Z'),
    );

    expect(rollups).toHaveLength(1);
    expect(rollups[0]!.id).toBe('rollup-a');
  });

  it('normalizes dates to UTC calendar day', () => {
    expect(normalizeUtcDate(new Date('2026-05-27T23:59:59.000Z')).toISOString()).toBe(
      '2026-05-27T00:00:00.000Z',
    );
  });

  it('calculates tenant overview from current ticket and breach state', async () => {
    const { repository } = createRepository();

    const overview = await repository.getOverview(tenantAContext);

    expect(overview).toEqual({
      openTicketCount: 1,
      newTicketCount: 1,
      pendingTicketCount: 2,
      resolvedTicketCount: 1,
      closedTicketCount: 1,
      totalSlaBreachCount: 2,
      unresolvedSlaBreachCount: 1,
      avgFirstResponseSeconds: 900.5,
      avgResolutionSeconds: 10_800,
    });
  });
});

function createRepository() {
  const data = createDataSet();
  const prisma = createMockPrisma(data);

  return {
    repository: new AnalyticsRepository(prisma as unknown as PrismaService),
    prisma,
  };
}

function createMockPrisma(data: ReturnType<typeof createDataSet>) {
  return {
    analyticsDailyRollup: {
      upsert: vi.fn().mockImplementation(({ create }: { create: AnalyticsDailyRollupRecord }) => create),
      findMany: vi.fn(({ where }: { where: { tenantId: string; date: DateWhere } }) =>
        data.rollups.filter(
          (rollup) =>
            rollup.tenantId === where.tenantId &&
            isInRange(rollup.date, where.date.gte, where.date.lteInclusive ?? where.date.lte),
        ),
      ),
    },
    ticket: {
      count: vi.fn(({ where }: { where: TicketWhere }) => filterTickets(data.tickets, where).length),
      findMany: vi.fn(({ where }: { where: TicketWhere }) => filterTickets(data.tickets, where)),
    },
    ticketComment: {
      count: vi.fn(({ where }: { where: CommentWhere }) => filterComments(data.comments, where).length),
    },
    slaBreach: {
      count: vi.fn(({ where }: { where: BreachWhere }) => filterBreaches(data.breaches, where).length),
    },
  };
}

type DateWhere = {
  gte?: Date;
  lt?: Date;
  lte?: Date;
  lteInclusive?: Date;
};

type TicketWhere = {
  tenantId: string;
  status?: string;
  createdAt?: DateWhere;
  resolvedAt?: DateWhere | { not: null };
  closedAt?: DateWhere;
  firstRespondedAt?: DateWhere | { not: null };
};

type CommentWhere = {
  tenantId: string;
  visibility: 'PUBLIC' | 'INTERNAL';
  createdAt: DateWhere;
};

type BreachWhere = {
  tenantId: string;
  breachType?: 'FIRST_RESPONSE' | 'RESOLUTION';
  breachedAt?: DateWhere;
  acknowledgedAt?: null;
};

function filterTickets(tickets: ReturnType<typeof createDataSet>['tickets'], where: TicketWhere) {
  return tickets
    .filter((ticket) => ticket.tenantId === where.tenantId)
    .filter((ticket) => (where.status ? ticket.status === where.status : true))
    .filter((ticket) => matchesDate(ticket.createdAt, where.createdAt))
    .filter((ticket) => matchesNullableDate(ticket.resolvedAt, where.resolvedAt))
    .filter((ticket) => matchesNullableDate(ticket.closedAt, where.closedAt))
    .filter((ticket) => matchesNullableDate(ticket.firstRespondedAt, where.firstRespondedAt));
}

function filterComments(comments: ReturnType<typeof createDataSet>['comments'], where: CommentWhere) {
  return comments
    .filter((comment) => comment.tenantId === where.tenantId)
    .filter((comment) => comment.visibility === where.visibility)
    .filter((comment) => matchesDate(comment.createdAt, where.createdAt));
}

function filterBreaches(breaches: ReturnType<typeof createDataSet>['breaches'], where: BreachWhere) {
  return breaches
    .filter((breach) => breach.tenantId === where.tenantId)
    .filter((breach) => (where.breachType ? breach.breachType === where.breachType : true))
    .filter((breach) => (where.acknowledgedAt === null ? breach.acknowledgedAt === null : true))
    .filter((breach) => matchesDate(breach.breachedAt, where.breachedAt));
}

function matchesNullableDate(value: Date | null, where: DateWhere | { not: null } | undefined) {
  if (!where) {
    return true;
  }

  if ('not' in where) {
    return value !== null;
  }

  return value ? matchesDate(value, where) : false;
}

function matchesDate(value: Date, where: DateWhere | undefined) {
  if (!where) {
    return true;
  }

  if (where.gte && value < where.gte) {
    return false;
  }

  if (where.lt && value >= where.lt) {
    return false;
  }

  if (where.lte && value > where.lte) {
    return false;
  }

  return true;
}

function isInRange(value: Date, from?: Date, to?: Date) {
  return (!from || value >= from) && (!to || value <= to);
}

function createDataSet() {
  return {
    tickets: [
      makeTicket({
        id: 'opened-a',
        status: 'NEW',
        createdAt: new Date('2026-05-27T00:15:00.000Z'),
      }),
      makeTicket({
        id: 'opened-b',
        status: 'OPEN',
        createdAt: new Date('2026-05-27T23:59:59.000Z'),
        firstRespondedAt: new Date('2026-05-28T00:00:00.000Z'),
      }),
      makeTicket({
        id: 'created-before-resolved-on-target',
        status: 'RESOLVED',
        createdAt: new Date('2026-05-26T21:00:00.000Z'),
        resolvedAt: new Date('2026-05-27T00:00:00.000Z'),
      }),
      makeTicket({
        id: 'closed-on-target',
        status: 'CLOSED',
        createdAt: new Date('2026-05-27T09:00:00.000Z'),
        closedAt: new Date('2026-05-27T10:00:00.000Z'),
        firstRespondedAt: new Date('2026-05-27T09:30:00.000Z'),
      }),
      makeTicket({
        id: 'pending-customer',
        status: 'PENDING_CUSTOMER',
      }),
      makeTicket({
        id: 'pending-internal',
        status: 'PENDING_INTERNAL',
      }),
      makeTicket({
        id: 'tenant-b-ticket',
        tenantId: tenantBId,
        status: 'NEW',
        createdAt: new Date('2026-05-27T12:00:00.000Z'),
      }),
    ],
    comments: [
      { tenantId: tenantAId, visibility: 'PUBLIC' as const, createdAt: new Date('2026-05-27T11:00:00.000Z') },
      { tenantId: tenantAId, visibility: 'INTERNAL' as const, createdAt: new Date('2026-05-27T11:05:00.000Z') },
      { tenantId: tenantBId, visibility: 'PUBLIC' as const, createdAt: new Date('2026-05-27T11:00:00.000Z') },
    ],
    breaches: [
      {
        tenantId: tenantAId,
        breachType: 'FIRST_RESPONSE' as const,
        breachedAt: new Date('2026-05-27T12:00:00.000Z'),
        acknowledgedAt: null,
      },
      {
        tenantId: tenantAId,
        breachType: 'RESOLUTION' as const,
        breachedAt: new Date('2026-05-27T13:00:00.000Z'),
        acknowledgedAt: new Date('2026-05-27T14:00:00.000Z'),
      },
      {
        tenantId: tenantBId,
        breachType: 'FIRST_RESPONSE' as const,
        breachedAt: new Date('2026-05-27T12:00:00.000Z'),
        acknowledgedAt: null,
      },
    ],
    rollups: [
      {
        id: 'rollup-a',
        tenantId: tenantAId,
        date: normalizedDate,
        ...makeRollupInput(),
        createdAt: normalizedDate,
        updatedAt: normalizedDate,
      },
      {
        id: 'rollup-b',
        tenantId: tenantBId,
        date: normalizedDate,
        ...makeRollupInput({ openedCount: 99 }),
        createdAt: normalizedDate,
        updatedAt: normalizedDate,
      },
    ],
  };
}

function makeTicket(overrides: {
  id: string;
  tenantId?: string;
  status?: string;
  createdAt?: Date;
  firstRespondedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
}) {
  return {
    id: overrides.id,
    tenantId: overrides.tenantId ?? tenantAId,
    status: overrides.status ?? 'OPEN',
    createdAt: overrides.createdAt ?? new Date('2026-05-26T12:00:00.000Z'),
    firstRespondedAt: overrides.firstRespondedAt ?? null,
    resolvedAt: overrides.resolvedAt ?? null,
    closedAt: overrides.closedAt ?? null,
  };
}

function makeRollupInput(overrides: Partial<AnalyticsDailyRollupInput> = {}): AnalyticsDailyRollupInput {
  return {
    openedCount: 0,
    resolvedCount: 0,
    closedCount: 0,
    publicCommentCount: 0,
    internalNoteCount: 0,
    firstResponseSlaBreachCount: 0,
    resolutionSlaBreachCount: 0,
    avgFirstResponseSeconds: null,
    avgResolutionSeconds: null,
    ...overrides,
  };
}
