import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from '../tenant-context/request-context';
import type {
  AnalyticsDailyRollupInput,
  AnalyticsPrismaClient,
} from './analytics.types';

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  upsertDailyRollup(
    tenantId: string,
    date: Date,
    data: AnalyticsDailyRollupInput,
    client: AnalyticsPrismaClient = this.prisma,
  ) {
    return client.analyticsDailyRollup.upsert({
      where: {
        tenantId_date: {
          tenantId,
          date,
        },
      },
      create: {
        tenantId,
        date,
        ...data,
      },
      update: data,
    });
  }

  getDailyRollups(
    ctx: RequestContext,
    from: Date,
    to: Date,
    client: AnalyticsPrismaClient = this.prisma,
  ) {
    return client.analyticsDailyRollup.findMany({
      where: {
        tenantId: ctx.tenantId,
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async getOverview(ctx: RequestContext, client: AnalyticsPrismaClient = this.prisma) {
    const [
      newTicketCount,
      openTicketCount,
      pendingCustomerTicketCount,
      pendingInternalTicketCount,
      resolvedTicketCount,
      closedTicketCount,
      totalSlaBreachCount,
      unresolvedSlaBreachCount,
      firstResponseTickets,
      resolvedTickets,
    ] = await Promise.all([
      client.ticket.count({ where: { tenantId: ctx.tenantId, status: 'NEW' } }),
      client.ticket.count({ where: { tenantId: ctx.tenantId, status: 'OPEN' } }),
      client.ticket.count({ where: { tenantId: ctx.tenantId, status: 'PENDING_CUSTOMER' } }),
      client.ticket.count({ where: { tenantId: ctx.tenantId, status: 'PENDING_INTERNAL' } }),
      client.ticket.count({ where: { tenantId: ctx.tenantId, status: 'RESOLVED' } }),
      client.ticket.count({ where: { tenantId: ctx.tenantId, status: 'CLOSED' } }),
      client.slaBreach.count({ where: { tenantId: ctx.tenantId } }),
      client.slaBreach.count({ where: { tenantId: ctx.tenantId, acknowledgedAt: null } }),
      client.ticket.findMany({
        where: {
          tenantId: ctx.tenantId,
          firstRespondedAt: { not: null },
        },
        select: { createdAt: true, firstRespondedAt: true },
      }),
      client.ticket.findMany({
        where: {
          tenantId: ctx.tenantId,
          resolvedAt: { not: null },
        },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    return {
      openTicketCount,
      newTicketCount,
      pendingTicketCount: pendingCustomerTicketCount + pendingInternalTicketCount,
      resolvedTicketCount,
      closedTicketCount,
      totalSlaBreachCount,
      unresolvedSlaBreachCount,
      avgFirstResponseSeconds: averageSeconds(
        firstResponseTickets,
        (ticket) => ticket.createdAt,
        (ticket) => ticket.firstRespondedAt,
      ),
      avgResolutionSeconds: averageSeconds(
        resolvedTickets,
        (ticket) => ticket.createdAt,
        (ticket) => ticket.resolvedAt,
      ),
    };
  }

  async calculateDailyRollupInput(
    tenantId: string,
    date: Date,
    client: AnalyticsPrismaClient = this.prisma,
  ): Promise<AnalyticsDailyRollupInput> {
    const { start, end } = utcDayRange(date);
    const [
      openedCount,
      resolvedTickets,
      closedCount,
      publicCommentCount,
      internalNoteCount,
      firstResponseSlaBreachCount,
      resolutionSlaBreachCount,
      firstResponseTickets,
    ] = await Promise.all([
      client.ticket.count({ where: { tenantId, createdAt: dayFilter(start, end) } }),
      client.ticket.findMany({
        where: { tenantId, resolvedAt: dayFilter(start, end) },
        select: { createdAt: true, resolvedAt: true },
      }),
      client.ticket.count({ where: { tenantId, closedAt: dayFilter(start, end) } }),
      client.ticketComment.count({ where: { tenantId, visibility: 'PUBLIC', createdAt: dayFilter(start, end) } }),
      client.ticketComment.count({ where: { tenantId, visibility: 'INTERNAL', createdAt: dayFilter(start, end) } }),
      client.slaBreach.count({
        where: { tenantId, breachType: 'FIRST_RESPONSE', breachedAt: dayFilter(start, end) },
      }),
      client.slaBreach.count({
        where: { tenantId, breachType: 'RESOLUTION', breachedAt: dayFilter(start, end) },
      }),
      client.ticket.findMany({
        where: { tenantId, firstRespondedAt: dayFilter(start, end) },
        select: { createdAt: true, firstRespondedAt: true },
      }),
    ]);

    return {
      openedCount,
      resolvedCount: resolvedTickets.length,
      closedCount,
      publicCommentCount,
      internalNoteCount,
      firstResponseSlaBreachCount,
      resolutionSlaBreachCount,
      avgFirstResponseSeconds: averageSeconds(
        firstResponseTickets,
        (ticket) => ticket.createdAt,
        (ticket) => ticket.firstRespondedAt,
      ),
      avgResolutionSeconds: averageSeconds(
        resolvedTickets,
        (ticket) => ticket.createdAt,
        (ticket) => ticket.resolvedAt,
      ),
    };
  }
}

export function normalizeUtcDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function utcDayRange(date: Date) {
  const start = normalizeUtcDate(date);
  const end = new Date(start.getTime() + 86_400_000);

  return { start, end };
}

function dayFilter(start: Date, end: Date): Prisma.DateTimeFilter {
  return {
    gte: start,
    lt: end,
  };
}

function averageSeconds<T>(
  values: T[],
  getStart: (value: T) => Date,
  getEnd: (value: T) => Date | null,
) {
  const durations = values
    .map((value) => {
      const end = getEnd(value);
      return end ? (end.getTime() - getStart(value).getTime()) / 1000 : null;
    })
    .filter((value): value is number => value !== null);

  if (durations.length === 0) {
    return null;
  }

  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}
