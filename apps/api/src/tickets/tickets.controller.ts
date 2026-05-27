import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CurrentRequestContext } from '../tenant-context/current-request-context.decorator';
import type { RequestContext } from '../tenant-context/request-context';
import { TenantContextGuard } from '../tenant-context/tenant-context.guard';
import { TicketApiService } from './ticket-api.service';
import {
  parseAssignTicketBody,
  parseCreateTicketBody,
  parseListQuery,
  parseTicketId,
  parseTransitionTicketBody,
  parseUpdateTicketBody,
} from './ticket-api.validation';
import { toTicketHttpException } from './ticket-http-errors';

@Controller('api/tenants/:tenantSlug/tickets')
@UseGuards(ClerkAuthGuard, TenantContextGuard, PermissionGuard)
export class TicketsController {
  constructor(@Inject(TicketApiService) private readonly tickets: TicketApiService) {}

  @Get()
  @RequirePermission('ticket:read')
  async listTickets(@CurrentRequestContext() ctx: RequestContext, @Query() query: Record<string, unknown>) {
    const filters = parseListQuery(query);

    return this.tickets.listTickets(ctx, filters);
  }

  @Post()
  @RequirePermission('ticket:create')
  async createTicket(@CurrentRequestContext() ctx: RequestContext, @Body() body: unknown) {
    try {
      return await this.tickets.createTicket(ctx, parseCreateTicketBody(body));
    } catch (error) {
      throw toTicketHttpException(error);
    }
  }

  @Get(':ticketId')
  @RequirePermission('ticket:read')
  async getTicket(@CurrentRequestContext() ctx: RequestContext, @Param('ticketId') ticketId: string) {
    try {
      return await this.tickets.getTicket(ctx, parseTicketId(ticketId));
    } catch (error) {
      throw toTicketHttpException(error);
    }
  }

  @Patch(':ticketId')
  @RequirePermission('ticket:update')
  async updateTicket(
    @CurrentRequestContext() ctx: RequestContext,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    try {
      return await this.tickets.updateTicket(ctx, parseTicketId(ticketId), parseUpdateTicketBody(body));
    } catch (error) {
      throw toTicketHttpException(error);
    }
  }

  @Post(':ticketId/transition')
  @RequirePermission('ticket:update')
  async transitionTicket(
    @CurrentRequestContext() ctx: RequestContext,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    try {
      const parsedBody = parseTransitionTicketBody(body);
      return await this.tickets.transitionTicket(ctx, parseTicketId(ticketId), parsedBody.status);
    } catch (error) {
      throw toTicketHttpException(error);
    }
  }

  @Post(':ticketId/assign')
  @RequirePermission('ticket:assign')
  async assignTicket(
    @CurrentRequestContext() ctx: RequestContext,
    @Param('ticketId') ticketId: string,
    @Body() body: unknown,
  ) {
    try {
      const parsedBody = parseAssignTicketBody(body);
      return await this.tickets.assignTicket(ctx, parseTicketId(ticketId), parsedBody.assigneeUserId);
    } catch (error) {
      throw toTicketHttpException(error);
    }
  }
}
