import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@triageflow/db';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from '../tenant-context/request-context';
import { TicketNotFoundError } from '../tickets/ticket.errors';
import { TicketService } from '../tickets/ticket.service';
import { CommentPermissionError, CommentTenantConstraintError } from './comment.errors';
import { CommentRepository } from './comment.repository';
import type { CommentListFilters, CommentPrismaClient, CommentRecord, CreateCommentInput } from './comment.types';

const internalReadPermission = 'comment:read_internal';
const publicCreatePermission = 'comment:create_public';
const internalCreatePermission = 'comment:create_internal';

@Injectable()
export class CommentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TicketService) private readonly tickets: TicketService,
    @Inject(CommentRepository) private readonly comments: CommentRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listForTicket(
    ctx: RequestContext,
    ticketId: string,
    filters: CommentListFilters = {},
    client?: CommentPrismaClient,
  ) {
    await this.assertTicketVisible(ctx, ticketId, client);
    return this.comments.findForTicket(
      ctx,
      ticketId,
      ctx.permissions.includes(internalReadPermission),
      filters,
      client,
    );
  }

  async createForTicket(ctx: RequestContext, ticketId: string, input: Omit<CreateCommentInput, 'ticketId'>) {
    this.assertCreatePermission(ctx, input.visibility);

    return this.prisma.$transaction(async (tx) => {
      const ticket = await this.assertTicketVisible(ctx, ticketId, tx);
      const comment = await this.comments.create(
        ctx,
        {
          ...input,
          ticketId,
          authorUserId: input.authorUserId !== undefined ? input.authorUserId : ctx.userId,
          ...(input.authorRequesterId !== undefined ? { authorRequesterId: input.authorRequesterId } : {}),
        },
        tx,
      );
      const firstRespondedAtChanged =
        comment.visibility === 'PUBLIC' && comment.authorUserId !== null && !ticket.firstRespondedAt;

      if (firstRespondedAtChanged) {
        await this.tickets.markFirstRespondedAtIfUnset(ctx, ticketId, comment.createdAt, tx);
      }

      await this.audit.record(
        ctx,
        {
          entityType: 'ticket_comment',
          entityId: comment.id,
          action: comment.visibility === 'INTERNAL' ? 'comment.internal_created' : 'comment.public_created',
          after: toAuditJson(comment),
          metadata: {
            ticketId,
            visibility: comment.visibility,
            firstRespondedAtChanged,
          },
        },
        tx,
      );

      return comment;
    });
  }

  private async assertTicketVisible(ctx: RequestContext, ticketId: string, client?: CommentPrismaClient) {
    try {
      return await this.tickets.getTicket(ctx, ticketId, client);
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        throw new CommentTenantConstraintError('Ticket was not found.');
      }

      throw error;
    }
  }

  private assertCreatePermission(ctx: RequestContext, visibility: CreateCommentInput['visibility']) {
    const requiredPermission = visibility === 'INTERNAL' ? internalCreatePermission : publicCreatePermission;

    if (!ctx.permissions.includes(requiredPermission)) {
      throw new CommentPermissionError('Required comment permission is missing.');
    }
  }
}

function toAuditJson(comment: CommentRecord): Prisma.InputJsonValue {
  return {
    id: comment.id,
    tenantId: comment.tenantId,
    ticketId: comment.ticketId,
    authorUserId: comment.authorUserId,
    authorRequesterId: comment.authorRequesterId,
    visibility: comment.visibility,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}
