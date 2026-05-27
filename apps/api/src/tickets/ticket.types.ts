import type { Prisma } from '@triageflow/db';

import type { CreatedAtIdCursor, CursorPage } from '../pagination/cursor';

export const ticketStatuses = [
  'NEW',
  'OPEN',
  'PENDING_CUSTOMER',
  'PENDING_INTERNAL',
  'RESOLVED',
  'CLOSED',
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type TicketPriority = (typeof ticketPriorities)[number];

export type TicketListFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeUserId?: string | null;
  limit?: number;
  cursor?: CreatedAtIdCursor;
};

export type CreateTicketInput = {
  requesterId: string;
  assigneeUserId?: string | null;
  status?: TicketStatus;
  priority?: TicketPriority;
  subject: string;
  description: string;
  createdAt?: Date;
  firstResponseDueAt?: Date | null;
  resolutionDueAt?: Date | null;
};

export type UpdateTicketInput = {
  requesterId?: string;
  assigneeUserId?: string | null;
  priority?: TicketPriority;
  subject?: string;
  description?: string;
  firstResponseDueAt?: Date | null;
  resolutionDueAt?: Date | null;
  firstRespondedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
};

export type TicketRecord = Prisma.TicketGetPayload<object>;

export type TicketListPage = CursorPage<TicketRecord>;

export type TicketPrismaClient = Pick<Prisma.TransactionClient, 'membership' | 'requester' | 'ticket'>;
