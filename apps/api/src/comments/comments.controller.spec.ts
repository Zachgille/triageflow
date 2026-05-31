import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from '../auth/auth.types';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { RbacModule } from '../rbac/rbac.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import type { TicketRecord } from '../tickets/ticket.types';
import { encodeCreatedAtIdCursor } from '../pagination/cursor';
import { CommentsModule } from './comments.module';
import type { CommentRecord } from './comment.types';

const tenantAId = '11111111-1111-4111-8111-111111111111';
const tenantBId = '22222222-2222-4222-8222-222222222222';
const adminUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const viewerUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tenantATicketId = '88888888-8888-4888-8888-888888888888';
const tenantBTicketId = '77777777-7777-4777-8777-777777777777';
const tenantARequesterId = '99999999-9999-4999-8999-999999999999';
const tenantBRequesterId = '12121212-1212-4121-8121-121212121212';

const tenants = [
  { id: tenantAId, slug: 'tenant-a' },
  { id: tenantBId, slug: 'tenant-b' },
];

const users = [
  { id: adminUserId, clerkAuthProviderId: 'clerk_admin' },
  { id: viewerUserId, clerkAuthProviderId: 'clerk_viewer' },
];

const memberships = [
  {
    id: 'membership-admin-a',
    tenantId: tenantAId,
    userId: adminUserId,
    status: 'ACTIVE',
    permissions: [
      'ticket:read',
      'comment:create_public',
      'comment:create_internal',
      'comment:read_internal',
    ],
  },
  {
    id: 'membership-viewer-a',
    tenantId: tenantAId,
    userId: viewerUserId,
    status: 'ACTIVE',
    permissions: ['ticket:read', 'comment:create_public'],
  },
];

let tickets: TicketRecord[];
let comments: CommentRecord[];
let auditCreate: ReturnType<typeof vi.fn>;
let commentSequence: number;

const mockIdentityProvider: AuthIdentityProvider = {
  authenticate(request: FastifyRequest) {
    const providerUserId = request.headers['x-test-provider-user-id'];

    if (typeof providerUserId !== 'string') {
      return null;
    }

    return {
      provider: 'clerk',
      providerUserId,
    };
  },
};

function createMockPrisma() {
  return {
    $transaction: vi.fn().mockImplementation((callback: (client: PrismaService) => unknown) => {
      return callback(createMockPrisma() as unknown as PrismaService);
    }),
    user: {
      findUnique: vi.fn(({ where }: { where: { clerkAuthProviderId: string } }) => {
        return users.find((user) => user.clerkAuthProviderId === where.clerkAuthProviderId) ?? null;
      }),
    },
    tenant: {
      findUnique: vi.fn(({ where }: { where: { slug: string } }) => {
        return tenants.find((tenant) => tenant.slug === where.slug) ?? null;
      }),
    },
    membership: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; userId: string; status: 'ACTIVE' } }) => {
        const membership = memberships.find(
          (candidate) =>
            candidate.tenantId === where.tenantId &&
            candidate.userId === where.userId &&
            candidate.status === where.status,
        );

        if (!membership) {
          return null;
        }

        return {
          id: membership.id,
          role: {
            rolePermissions: membership.permissions.map((permission) => ({
              permission: { key: permission },
            })),
          },
        };
      }),
      findUnique: vi.fn(({ where }: { where: { tenantId_userId: { tenantId: string; userId: string } } }) => {
        const membership = memberships.find(
          (candidate) =>
            candidate.tenantId === where.tenantId_userId.tenantId &&
            candidate.userId === where.tenantId_userId.userId,
        );

        return membership ? { id: membership.id } : null;
      }),
    },
    requester: {
      findUnique: vi.fn(),
    },
    ticket: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        return tickets.find((ticket) => ticket.id === where.id && ticket.tenantId === where.tenantId) ?? null;
      }),
      updateMany: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: string; tenantId: string; firstRespondedAt: null };
          data: { firstRespondedAt: Date };
        }) => {
          const index = tickets.findIndex(
            (ticket) =>
              ticket.id === where.id &&
              ticket.tenantId === where.tenantId &&
              ticket.firstRespondedAt === where.firstRespondedAt,
          );

          if (index === -1) {
            return { count: 0 };
          }

          tickets[index] = {
            ...tickets[index]!,
            firstRespondedAt: data.firstRespondedAt,
            updatedAt: data.firstRespondedAt,
          };

          return { count: 1 };
        },
      ),
    },
    ticketComment: {
      findMany: vi.fn(({ where, take }: { where: CommentWhere; take?: number }) => {
        const records = comments
          .filter((comment) => comment.tenantId === where.tenantId && comment.ticketId === where.ticketId)
          .filter((comment) => (where.visibility ? comment.visibility === where.visibility : true))
          .filter((comment) => matchesCommentCursor(comment, where.OR))
          .sort(compareCommentsAsc);

        return take === undefined ? records : records.slice(0, take);
      }),
      create: vi.fn(({ data }: { data: Partial<CommentRecord> }) => {
        const comment = createCommentRecord({
          id: `44444444-4444-4444-8444-${String(++commentSequence).padStart(12, '0')}`,
          tenantId: data.tenantId!,
          ticketId: data.ticketId!,
          authorUserId: data.authorUserId ?? null,
          authorRequesterId: data.authorRequesterId ?? null,
          visibility: data.visibility ?? 'PUBLIC',
          body: data.body!,
        });
        comments.push(comment);
        return comment;
      }),
    },
    auditLog: {
      create: auditCreate,
      findMany: vi.fn(),
    },
  };
}

describe('CommentsController', () => {
  let app: NestFastifyApplication | undefined;

  beforeEach(async () => {
    commentSequence = 0;
    auditCreate = vi.fn(({ data }) => Promise.resolve({ id: 'audit-id', ...data }));
    tickets = [
      createTicketRecord({ id: tenantATicketId, tenantId: tenantAId, requesterId: tenantARequesterId }),
      createTicketRecord({ id: tenantBTicketId, tenantId: tenantBId, requesterId: tenantBRequesterId }),
    ];
    comments = [
      createCommentRecord({
        id: '55555555-5555-4555-8555-555555555555',
        tenantId: tenantAId,
        ticketId: tenantATicketId,
        visibility: 'PUBLIC',
        body: 'Public tenant A comment',
      }),
      createCommentRecord({
        id: '66666666-6666-4666-8666-666666666666',
        tenantId: tenantAId,
        ticketId: tenantATicketId,
        visibility: 'INTERNAL',
        body: 'Internal tenant A note',
      }),
      createCommentRecord({
        id: '77777777-7777-4777-8777-777777777777',
        tenantId: tenantBId,
        ticketId: tenantBTicketId,
        visibility: 'PUBLIC',
        body: 'Public tenant B comment',
      }),
    ];

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, AuditModule, DatabaseModule, TenantContextModule, RbacModule, CommentsModule],
    })
      .overrideProvider(AUTH_IDENTITY_PROVIDER)
      .useValue(mockIdentityProvider)
      .overrideProvider(PrismaService)
      .useValue(createMockPrisma())
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('creates public comments', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_viewer'),
      payload: { visibility: 'PUBLIC', body: 'A public reply' },
    });
    const body = response.json<CommentRecord>();

    expect(response.statusCode).toBe(201);
    expect(body.visibility).toBe('PUBLIC');
    expect(body.tenantId).toBe(tenantAId);
  });

  it('requires permission to create internal notes', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_viewer'),
      payload: { visibility: 'INTERNAL', body: 'Internal note' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('does not return internal notes to viewers without internal read permission', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: CommentRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.visibility).toBe('PUBLIC');
  });

  it('returns internal notes only to users with internal read permission', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
    });
    const body = response.json<{ items: CommentRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items.map((comment) => comment.visibility)).toEqual(['PUBLIC', 'INTERNAL']);
  });

  it('returns 404 for comments on a cross-tenant ticket', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantBTicketId}/comments`,
      headers: authHeaders('clerk_admin'),
    });

    expect(response.statusCode).toBe(404);
  });

  it('lists only comments for the current tenant ticket', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
    });
    const body = response.json<{ items: CommentRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items.every((comment) => comment.tenantId === tenantAId)).toBe(true);
  });

  it('returns a cursor when more visible comments exist', async () => {
    addTenantAComment({
      id: '55555555-5555-4555-8555-555555555556',
      body: 'Second public comment',
      visibility: 'PUBLIC',
      createdAt: new Date('2026-05-26T12:01:00.000Z'),
    });

    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments?limit=1`,
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: CommentRecord[]; nextCursor: string | null; hasMore: boolean }>();

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toEqual(expect.any(String));
    expect(body.hasMore).toBe(true);
  });

  it('uses comment cursors in ascending timeline order', async () => {
    addTenantAComment({
      id: '55555555-5555-4555-8555-555555555556',
      body: 'Second public comment',
      visibility: 'PUBLIC',
      createdAt: new Date('2026-05-26T12:01:00.000Z'),
    });
    const firstComment = comments.find((comment) => comment.id === '55555555-5555-4555-8555-555555555555')!;
    const cursor = encodeCreatedAtIdCursor(firstComment);

    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments?cursor=${encodeURIComponent(cursor)}`,
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: CommentRecord[]; hasMore: boolean }>();

    expect(response.statusCode).toBe(200);
    expect(body.items.map((comment) => comment.body)).toEqual(['Second public comment']);
    expect(body.hasMore).toBe(false);
  });

  it('rejects invalid comment cursors', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments?cursor=bad`,
      headers: authHeaders('clerk_viewer'),
    });

    expect(response.statusCode).toBe(400);
  });

  it('orders comment cursors deterministically when created_at matches', async () => {
    comments = [
      createCommentRecord({
        id: '55555555-5555-4555-8555-555555555551',
        tenantId: tenantAId,
        ticketId: tenantATicketId,
        visibility: 'PUBLIC',
        body: 'Lower id',
      }),
      createCommentRecord({
        id: '55555555-5555-4555-8555-555555555559',
        tenantId: tenantAId,
        ticketId: tenantATicketId,
        visibility: 'PUBLIC',
        body: 'Higher id',
      }),
    ];

    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: CommentRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items.map((comment) => comment.body)).toEqual(['Lower id', 'Higher id']);
  });

  it('rejects creating a comment on another tenant ticket', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantBTicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'PUBLIC', body: 'Cross tenant comment' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('writes an audit log when creating a comment', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'INTERNAL', body: 'Audited internal note' },
    });

    expect(response.statusCode).toBe(201);
    expect(lastAuditData()).toMatchObject({
      tenantId: tenantAId,
      actorUserId: adminUserId,
      action: 'comment.internal_created',
    });
  });

  it('sets first_responded_at when an internal user creates the first public comment', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'PUBLIC', body: 'First public agent reply' },
    });

    expect(response.statusCode).toBe(201);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.firstRespondedAt?.toISOString()).toBe(
      '2026-05-26T12:00:00.000Z',
    );
    expect(lastAuditData()).toMatchObject({
      action: 'comment.public_created',
      metadata: {
        firstRespondedAtChanged: true,
      },
    });
  });

  it('does not overwrite first_responded_at on later public agent comments', async () => {
    const existingFirstRespondedAt = new Date('2026-05-26T11:00:00.000Z');
    tickets = tickets.map((ticket) =>
      ticket.id === tenantATicketId ? { ...ticket, firstRespondedAt: existingFirstRespondedAt } : ticket,
    );

    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'PUBLIC', body: 'Later public agent reply' },
    });

    expect(response.statusCode).toBe(201);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.firstRespondedAt).toBe(
      existingFirstRespondedAt,
    );
    expect(lastAuditData()).toMatchObject({
      metadata: {
        firstRespondedAtChanged: false,
      },
    });
  });

  it('does not set first_responded_at for internal notes', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'INTERNAL', body: 'Internal investigation note' },
    });

    expect(response.statusCode).toBe(201);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.firstRespondedAt).toBeNull();
  });

  it('keeps first-response timestamp updates tenant-scoped', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantBTicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'PUBLIC', body: 'Cross tenant reply' },
    });

    expect(response.statusCode).toBe(404);
    expect(tickets.find((ticket) => ticket.id === tenantBTicketId)?.firstRespondedAt).toBeNull();
  });

  it('rejects comment bodies over the maximum length', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'PUBLIC', body: 'x'.repeat(10001) },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects empty comment bodies', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/comments`,
      headers: authHeaders('clerk_admin'),
      payload: { visibility: 'PUBLIC', body: '   ' },
    });

    expect(response.statusCode).toBe(400);
  });
});

function authHeaders(providerUserId: string) {
  return { 'x-test-provider-user-id': providerUserId };
}

function lastAuditData() {
  const calls = auditCreate.mock.calls as Array<[{ data: Record<string, unknown> }]>;
  return calls[calls.length - 1]![0].data;
}

type CommentWhere = Partial<CommentRecord> & {
  OR?: Array<{ createdAt: { gt: Date } } | { createdAt: Date; id: { gt: string } }>;
};

function matchesCommentCursor(comment: CommentRecord, cursorConditions: CommentWhere['OR']) {
  if (!cursorConditions) {
    return true;
  }

  return cursorConditions.some((condition) => {
    if ('id' in condition) {
      return comment.createdAt.getTime() === condition.createdAt.getTime() && comment.id > condition.id.gt;
    }

    return comment.createdAt.getTime() > condition.createdAt.gt.getTime();
  });
}

function compareCommentsAsc(left: CommentRecord, right: CommentRecord) {
  const createdAtCompare = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  return left.id.localeCompare(right.id);
}

function addTenantAComment(input: Partial<CommentRecord> & Pick<CommentRecord, 'id' | 'visibility' | 'body'>) {
  const comment = createCommentRecord({
    tenantId: tenantAId,
    ticketId: tenantATicketId,
    ...input,
  });
  comments.push(comment);
  return comment;
}

function createTicketRecord(input: Pick<TicketRecord, 'id' | 'tenantId' | 'requesterId'>): TicketRecord {
  const now = new Date('2026-05-26T12:00:00.000Z');

  return {
    assigneeUserId: null,
    status: 'OPEN',
    priority: 'NORMAL',
    subject: 'Test ticket',
    description: 'Test description',
    firstResponseDueAt: null,
    resolutionDueAt: null,
    firstRespondedAt: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

function createCommentRecord(
  input: Pick<CommentRecord, 'id' | 'tenantId' | 'ticketId' | 'visibility' | 'body'> &
    Partial<CommentRecord>,
): CommentRecord {
  return {
    authorUserId: adminUserId,
    authorRequesterId: null,
    createdAt: new Date('2026-05-26T12:00:00.000Z'),
    ...input,
  };
}
