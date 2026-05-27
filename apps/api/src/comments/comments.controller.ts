import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentRequestContext } from '../tenant-context/current-request-context.decorator';
import type { RequestContext } from '../tenant-context/request-context';
import { TenantContextGuard } from '../tenant-context/tenant-context.guard';
import { parseCommentListQuery, parseCreateCommentBody, parseTicketId } from './comment-api.validation';
import { toCommentHttpException } from './comment-http-errors';
import { CommentService } from './comment.service';

@Controller('api/tenants/:tenantSlug/tickets/:ticketId/comments')
@UseGuards(ClerkAuthGuard, TenantContextGuard, PermissionGuard)
export class CommentsController {
  constructor(@Inject(CommentService) private readonly comments: CommentService) {}

  @Get()
  @RequirePermission('ticket:read')
  async listComments(
    @CurrentRequestContext() ctx: RequestContext,
    @Param('ticketId') ticketId: string,
    @Query() query: Record<string, unknown>,
  ) {
    try {
      return await this.comments.listForTicket(ctx, parseTicketId(ticketId), parseCommentListQuery(query));
    } catch (error) {
      throw toCommentHttpException(error);
    }
  }

  @Post()
  async createComment(
    @CurrentRequestContext() ctx: RequestContext,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    try {
      const parsedBody = parseCreateCommentBody(body);
      return await this.comments.createForTicket(ctx, parseTicketId(ticketId), {
        ...parsedBody,
        authorUserId: ctx.userId,
      });
    } catch (error) {
      throw toCommentHttpException(error);
    }
  }
}
