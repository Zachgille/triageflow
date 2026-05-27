import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import type { AnalyticsDailyRollupInput, AnalyticsPrismaClient } from './analytics.types';

@Injectable()
export class AnalyticsRollupRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async upsertDailyRollup(
    tenantId: string,
    date: Date,
    data: AnalyticsDailyRollupInput,
    client: AnalyticsPrismaClient = this.prisma,
  ): Promise<'created' | 'updated'> {
    const existing = await client.analyticsDailyRollup.findUnique({
      where: {
        tenantId_date: {
          tenantId,
          date,
        },
      },
      select: { id: true },
    });

    await client.analyticsDailyRollup.upsert({
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

    return existing ? 'updated' : 'created';
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

  async findTenantIds(limit: number, client: AnalyticsPrismaClient = this.prisma): Promise<string[]> {
    const tenants = await client.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });

    return tenants.map((tenant) => tenant.id);
  }
}

export function normalizeUtcDate(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function defaultRollupDate(now: Date) {
  return normalizeUtcDate(new Date(now.getTime() - 86_400_000));
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
