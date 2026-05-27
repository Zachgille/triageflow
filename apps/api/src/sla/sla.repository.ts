import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from '../tenant-context/request-context';
import { RequestContextRequiredError } from '../tickets/ticket.errors';
import type { TicketPriority } from '../tickets/ticket.types';
import type { CreateSlaBreachInput, SlaBreachRecord, SlaPrismaClient } from './sla.types';

@Injectable()
export class SlaRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findPolicyForTicket(
    ctx: RequestContext,
    ticketPriority: TicketPriority,
    client: SlaPrismaClient = this.prisma,
  ) {
    this.assertContext(ctx);

    return client.slaPolicy.findUnique({
      where: {
        tenantId_priority: {
          tenantId: ctx.tenantId,
          priority: ticketPriority,
        },
      },
    });
  }

  async createBreach(
    ctx: RequestContext,
    input: CreateSlaBreachInput,
    client: SlaPrismaClient = this.prisma,
  ): Promise<SlaBreachRecord> {
    this.assertContext(ctx);
    const breachType = toPrismaBreachType(input.breachType);

    try {
      return await client.slaBreach.create({
        data: {
          tenantId: ctx.tenantId,
          ticketId: input.ticketId,
          breachType,
          breachedAt: input.breachedAt,
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await client.slaBreach.findUnique({
          where: {
            tenantId_ticketId_breachType: {
              tenantId: ctx.tenantId,
              ticketId: input.ticketId,
              breachType,
            },
          },
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  private assertContext(ctx: RequestContext | undefined): asserts ctx is RequestContext {
    if (!ctx?.tenantId) {
      throw new RequestContextRequiredError();
    }
  }
}

function toPrismaBreachType(breachType: CreateSlaBreachInput['breachType']) {
  return breachType === 'first_response' ? 'FIRST_RESPONSE' : 'RESOLUTION';
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
