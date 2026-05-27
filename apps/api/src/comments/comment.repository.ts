import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import { toCursorPage } from '../pagination/cursor';
import type { RequestContext } from '../tenant-context/request-context';
import { CommentTenantConstraintError } from './comment.errors';
import type {
  CommentListFilters,
  CommentListPage,
  CommentPrismaClient,
  CommentRecord,
  CreateCommentInput,
} from './comment.types';

@Injectable()
export class CommentRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findForTicket(
    ctx: RequestContext,
    ticketId: string,
    includeInternal: boolean,
    filters: CommentListFilters = {},
    client: CommentPrismaClient = this.prisma,
  ): Promise<CommentListPage> {
    const limit = filters.limit ?? 50;
    const records = await client.ticketComment.findMany({
      where: {
        tenantId: ctx.tenantId,
        ticketId,
        ...(includeInternal ? {} : { visibility: 'PUBLIC' }),
        ...(filters.cursor
          ? {
              OR: [
                { createdAt: { gt: filters.cursor.createdAt } },
                { createdAt: filters.cursor.createdAt, id: { gt: filters.cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    return toCursorPage(records, limit);
  }

  async create(
    ctx: RequestContext,
    input: CreateCommentInput,
    client: CommentPrismaClient = this.prisma,
  ): Promise<CommentRecord> {
    await this.assertTicketInTenant(ctx, input.ticketId, client);
    await this.assertAuthorUserInTenant(ctx, input.authorUserId, client);
    await this.assertAuthorRequesterInTenant(ctx, input.authorRequesterId, client);
    this.assertExactlyOneAuthor(input);

    const data: Prisma.TicketCommentUncheckedCreateInput = {
      tenantId: ctx.tenantId,
      ticketId: input.ticketId,
      visibility: input.visibility,
      body: input.body,
      ...(input.authorUserId !== undefined ? { authorUserId: input.authorUserId } : {}),
      ...(input.authorRequesterId !== undefined ? { authorRequesterId: input.authorRequesterId } : {}),
    };

    return client.ticketComment.create({ data });
  }

  private async assertTicketInTenant(ctx: RequestContext, ticketId: string, client: CommentPrismaClient) {
    const ticket = await client.ticket.findFirst({
      where: {
        id: ticketId,
        tenantId: ctx.tenantId,
      },
      select: { id: true },
    });

    if (!ticket) {
      throw new CommentTenantConstraintError('Ticket was not found.');
    }
  }

  private async assertAuthorUserInTenant(
    ctx: RequestContext,
    authorUserId: string | null | undefined,
    client: CommentPrismaClient,
  ) {
    if (!authorUserId) {
      return;
    }

    const membership = await client.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: ctx.tenantId,
          userId: authorUserId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new CommentTenantConstraintError('Comment author user must belong to the current tenant.');
    }
  }

  private async assertAuthorRequesterInTenant(
    ctx: RequestContext,
    authorRequesterId: string | null | undefined,
    client: CommentPrismaClient,
  ) {
    if (!authorRequesterId) {
      return;
    }

    const requester = await client.requester.findUnique({
      where: {
        tenantId_id: {
          tenantId: ctx.tenantId,
          id: authorRequesterId,
        },
      },
      select: { id: true },
    });

    if (!requester) {
      throw new CommentTenantConstraintError('Comment author requester must belong to the current tenant.');
    }
  }

  private assertExactlyOneAuthor(input: CreateCommentInput) {
    const authorCount = [input.authorUserId, input.authorRequesterId].filter(Boolean).length;

    if (authorCount !== 1) {
      throw new CommentTenantConstraintError('Exactly one comment author is required.');
    }
  }
}
