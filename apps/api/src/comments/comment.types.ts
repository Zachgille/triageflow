import type { Prisma } from '@triageflow/db';

import type { CreatedAtIdCursor, CursorPage } from '../pagination/cursor';

export const commentVisibilities = ['PUBLIC', 'INTERNAL'] as const;

export type CommentVisibility = (typeof commentVisibilities)[number];

export type CommentRecord = Prisma.TicketCommentGetPayload<object>;

export type CommentListFilters = {
  limit?: number;
  cursor?: CreatedAtIdCursor;
};

export type CommentListPage = CursorPage<CommentRecord>;

export type CommentPrismaClient = Pick<
  Prisma.TransactionClient,
  'membership' | 'requester' | 'ticket' | 'ticketComment'
>;

export type CreateCommentInput = {
  ticketId: string;
  authorUserId?: string | null;
  authorRequesterId?: string | null;
  visibility: CommentVisibility;
  body: string;
};
