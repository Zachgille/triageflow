import { describe, expect, it, vi } from 'vitest';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from '../tenant-context/request-context';
import { TicketService } from '../tickets/ticket.service';
import { CommentRepository } from './comment.repository';
import { CommentService } from './comment.service';
import type { CommentRecord } from './comment.types';

const ctx: RequestContext = {
  requestId: 'request-1',
  userId: 'agent-1',
  tenantId: 'tenant-1',
  membershipId: 'membership-1',
  permissions: ['ticket:read', 'comment:create_public'],
};

const commentCreatedAt = new Date('2026-05-26T12:00:00.000Z');

describe('CommentService SLA first-response integration', () => {
  it('does not satisfy first response for requester-authored public comments', async () => {
    const markFirstRespondedAtIfUnset = vi.fn();
    const service = new CommentService(
      {
        $transaction: vi.fn((callback: (client: PrismaService) => Promise<unknown>) =>
          callback({} as PrismaService),
        ),
      } as unknown as PrismaService,
      {
        getTicket: vi.fn().mockResolvedValue({ id: 'ticket-1' }),
        markFirstRespondedAtIfUnset,
      } as unknown as TicketService,
      {
        create: vi.fn().mockResolvedValue(
          makeComment({
            authorUserId: null,
            authorRequesterId: 'requester-1',
            visibility: 'PUBLIC',
          }),
        ),
      } as unknown as CommentRepository,
      {
        record: vi.fn(),
      } as unknown as AuditService,
    );

    await service.createForTicket(ctx, 'ticket-1', {
      authorUserId: null,
      authorRequesterId: 'requester-1',
      visibility: 'PUBLIC',
      body: 'Customer follow-up.',
    });

    expect(markFirstRespondedAtIfUnset).not.toHaveBeenCalled();
  });
});

function makeComment(overrides: Partial<CommentRecord> = {}): CommentRecord {
  return {
    id: 'comment-1',
    tenantId: ctx.tenantId,
    ticketId: 'ticket-1',
    authorUserId: ctx.userId,
    authorRequesterId: null,
    visibility: 'PUBLIC',
    body: 'Comment body.',
    createdAt: commentCreatedAt,
    ...overrides,
  };
}
