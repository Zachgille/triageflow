import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import type { SlaBreachCandidate, SlaTicketSnapshot } from './sla-breach.types';

const defaultLimit = 100;
const maxLimit = 500;

@Injectable()
export class SlaBreachRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findTicketsWithPotentialSlaBreaches(
    now: Date,
    limit = defaultLimit,
    tenantId?: string,
  ): Promise<SlaTicketSnapshot[]> {
    const boundedLimit = normalizeLimit(limit);

    return this.prisma.ticket.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        OR: [
          {
            firstResponseDueAt: { lt: now },
            firstRespondedAt: null,
          },
          {
            resolutionDueAt: { lt: now },
            resolvedAt: null,
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: boundedLimit,
    });
  }

  async createBreachIfMissing(input: SlaBreachCandidate): Promise<'created' | 'existing'> {
    const breachType = toPrismaBreachType(input.breachType);

    try {
      await this.prisma.slaBreach.create({
        data: {
          tenantId: input.tenantId,
          ticketId: input.ticketId,
          breachType,
          breachedAt: input.breachedAt,
          metadata: {},
        },
      });

      return 'created';
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return 'existing';
      }

      throw error;
    }
  }
}

function normalizeLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1) {
    return defaultLimit;
  }

  return Math.min(limit, maxLimit);
}

function toPrismaBreachType(breachType: SlaBreachCandidate['breachType']) {
  return breachType === 'first_response' ? 'FIRST_RESPONSE' : 'RESOLUTION';
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
