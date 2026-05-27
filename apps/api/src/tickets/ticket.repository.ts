import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import { toCursorPage } from '../pagination/cursor';
import type { RequestContext } from '../tenant-context/request-context';
import { RequestContextRequiredError, TicketTenantConstraintError } from './ticket.errors';
import type {
  CreateTicketInput,
  TicketPrismaClient,
  TicketListFilters,
  TicketListPage,
  TicketRecord,
  TicketStatus,
  UpdateTicketInput,
} from './ticket.types';

@Injectable()
export class TicketRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findMany(
    ctx: RequestContext,
    filters: TicketListFilters = {},
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketListPage> {
    this.assertContext(ctx);
    const limit = filters.limit ?? 50;
    const where: Prisma.TicketWhereInput = {
      tenantId: ctx.tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.assigneeUserId !== undefined ? { assigneeUserId: filters.assigneeUserId } : {}),
      ...(filters.cursor
        ? {
            OR: [
              { createdAt: { lt: filters.cursor.createdAt } },
              { createdAt: filters.cursor.createdAt, id: { lt: filters.cursor.id } },
            ],
          }
        : {}),
    };

    const records = await client.ticket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return toCursorPage(records, limit);
  }

  async findById(
    ctx: RequestContext,
    ticketId: string,
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketRecord | null> {
    this.assertContext(ctx);

    return client.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId: ctx.tenantId,
      },
    });
  }

  async create(
    ctx: RequestContext,
    input: CreateTicketInput,
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketRecord> {
    this.assertContext(ctx);
    await this.assertRequesterInTenant(ctx, input.requesterId, client);
    await this.assertAssigneeInTenant(ctx, input.assigneeUserId, client);
    const data: Prisma.TicketUncheckedCreateInput = {
      tenantId: ctx.tenantId,
      requesterId: input.requesterId,
      subject: input.subject,
      description: input.description,
      ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
      ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.firstResponseDueAt !== undefined ? { firstResponseDueAt: input.firstResponseDueAt } : {}),
      ...(input.resolutionDueAt !== undefined ? { resolutionDueAt: input.resolutionDueAt } : {}),
    };

    return client.ticket.create({
      data,
    });
  }

  async updateFields(
    ctx: RequestContext,
    ticketId: string,
    input: UpdateTicketInput,
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketRecord | null> {
    this.assertContext(ctx);
    await this.assertRequesterInTenant(ctx, input.requesterId, client);
    await this.assertAssigneeInTenant(ctx, input.assigneeUserId, client);

    const ticket = await this.findById(ctx, ticketId, client);

    if (!ticket) {
      return null;
    }

    const data: Prisma.TicketUncheckedUpdateInput = {
      ...input,
    };

    return client.ticket.update({
      where: { id: ticket.id },
      data,
    });
  }

  async transitionStatus(
    ctx: RequestContext,
    ticketId: string,
    nextStatus: TicketStatus,
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketRecord | null> {
    this.assertContext(ctx);

    const ticket = await this.findById(ctx, ticketId, client);

    if (!ticket) {
      return null;
    }

    const data: Prisma.TicketUncheckedUpdateInput = {
      status: nextStatus,
      ...(nextStatus === 'RESOLVED' && !ticket.resolvedAt ? { resolvedAt: new Date() } : {}),
      ...(nextStatus === 'CLOSED' && !ticket.closedAt ? { closedAt: new Date() } : {}),
    };

    return client.ticket.update({
      where: { id: ticket.id },
      data,
    });
  }

  async markFirstRespondedAtIfUnset(
    ctx: RequestContext,
    ticketId: string,
    firstRespondedAt: Date,
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketRecord | null> {
    this.assertContext(ctx);

    const result = await client.ticket.updateMany({
      where: {
        id: ticketId,
        tenantId: ctx.tenantId,
        firstRespondedAt: null,
      },
      data: { firstRespondedAt },
    });

    if (result.count === 0) {
      return this.findById(ctx, ticketId, client);
    }

    return this.findById(ctx, ticketId, client);
  }

  async assign(
    ctx: RequestContext,
    ticketId: string,
    assigneeUserId: string | null,
    client: TicketPrismaClient = this.prisma,
  ): Promise<TicketRecord | null> {
    this.assertContext(ctx);
    await this.assertAssigneeInTenant(ctx, assigneeUserId, client);

    const ticket = await this.findById(ctx, ticketId, client);

    if (!ticket) {
      return null;
    }

    return client.ticket.update({
      where: { id: ticket.id },
      data: { assigneeUserId },
    });
  }

  private assertContext(ctx: RequestContext | undefined): asserts ctx is RequestContext {
    if (!ctx?.tenantId) {
      throw new RequestContextRequiredError();
    }
  }

  private async assertRequesterInTenant(
    ctx: RequestContext,
    requesterId: string | undefined,
    client: TicketPrismaClient,
  ) {
    if (!requesterId) {
      return;
    }

    const requester = await client.requester.findUnique({
      where: {
        tenantId_id: {
          tenantId: ctx.tenantId,
          id: requesterId,
        },
      },
      select: { id: true },
    });

    if (!requester) {
      throw new TicketTenantConstraintError('Requester must belong to the current tenant.');
    }
  }

  private async assertAssigneeInTenant(
    ctx: RequestContext,
    assigneeUserId: string | null | undefined,
    client: TicketPrismaClient,
  ) {
    if (!assigneeUserId) {
      return;
    }

    const membership = await client.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: ctx.tenantId,
          userId: assigneeUserId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new TicketTenantConstraintError('Assignee must be a member of the current tenant.');
    }
  }
}
