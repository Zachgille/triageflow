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
import { TicketsModule } from './tickets.module';
import type { TicketRecord } from './ticket.types';
import { encodeCreatedAtIdCursor } from '../pagination/cursor';

type TenantRecord = {
  id: string;
  slug: string;
};

type UserRecord = {
  id: string;
  clerkAuthProviderId: string;
};

type MembershipRecord = {
  id: string;
  tenantId: string;
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  permissions: string[];
};

type RequesterRecord = {
  id: string;
  tenantId: string;
};

type SlaPolicyRecord = {
  tenantId: string;
  priority: TicketRecord['priority'];
  firstResponseMinutes: number;
  resolutionMinutes: number;
};

type CreateTicketPayload = {
  requesterId: string;
  priority: TicketRecord['priority'];
  subject: string;
  description: string;
};

const tenantAId = '11111111-1111-4111-8111-111111111111';
const tenantBId = '22222222-2222-4222-8222-222222222222';
const adminUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const agentUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const viewerUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const suspendedUserId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const tenantBTicketId = '77777777-7777-4777-8777-777777777777';
const tenantATicketId = '88888888-8888-4888-8888-888888888888';
const tenantARequesterId = '99999999-9999-4999-8999-999999999999';
const tenantBRequesterId = '12121212-1212-4121-8121-121212121212';

const tenants: TenantRecord[] = [
  { id: tenantAId, slug: 'tenant-a' },
  { id: tenantBId, slug: 'tenant-b' },
];

const users: UserRecord[] = [
  { id: adminUserId, clerkAuthProviderId: 'clerk_admin' },
  { id: agentUserId, clerkAuthProviderId: 'clerk_agent' },
  { id: viewerUserId, clerkAuthProviderId: 'clerk_viewer' },
  { id: suspendedUserId, clerkAuthProviderId: 'clerk_suspended' },
];

const memberships: MembershipRecord[] = [
  {
    id: 'membership-admin-a',
    tenantId: tenantAId,
    userId: adminUserId,
    status: 'ACTIVE',
    permissions: ['ticket:read', 'ticket:create', 'ticket:update', 'ticket:assign'],
  },
  {
    id: 'membership-admin-b',
    tenantId: tenantBId,
    userId: adminUserId,
    status: 'ACTIVE',
    permissions: ['ticket:read'],
  },
  {
    id: 'membership-agent-a',
    tenantId: tenantAId,
    userId: agentUserId,
    status: 'ACTIVE',
    permissions: ['ticket:read', 'ticket:update', 'ticket:assign'],
  },
  {
    id: 'membership-viewer-a',
    tenantId: tenantAId,
    userId: viewerUserId,
    status: 'ACTIVE',
    permissions: ['ticket:read'],
  },
  {
    id: 'membership-suspended-a',
    tenantId: tenantAId,
    userId: suspendedUserId,
    status: 'SUSPENDED',
    permissions: ['ticket:read', 'ticket:create', 'ticket:update', 'ticket:assign'],
  },
];

const requesters: RequesterRecord[] = [
  { id: tenantARequesterId, tenantId: tenantAId },
  { id: tenantBRequesterId, tenantId: tenantBId },
];

let tickets: TicketRecord[];
let slaPolicies: SlaPolicyRecord[];
let auditCreate: ReturnType<typeof vi.fn>;
let ticketIdSequence: number;

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
      findUnique: vi.fn(({ where }: { where: { tenantId_id: { tenantId: string; id: string } } }) => {
        return (
          requesters.find(
            (requester) =>
              requester.tenantId === where.tenantId_id.tenantId && requester.id === where.tenantId_id.id,
          ) ?? null
        );
      }),
    },
    slaPolicy: {
      findUnique: vi.fn(
        ({
          where,
        }: {
          where: { tenantId_priority: { tenantId: string; priority: TicketRecord['priority'] } };
        }) => {
          return (
            slaPolicies.find(
              (policy) =>
                policy.tenantId === where.tenantId_priority.tenantId &&
                policy.priority === where.tenantId_priority.priority,
            ) ?? null
          );
        },
      ),
    },
    ticket: {
      findMany: vi.fn(({ where, take }: { where: TicketWhere; take?: number }) => {
        const records = tickets
          .filter((ticket) => ticket.tenantId === where.tenantId)
          .filter((ticket) => (where.status ? ticket.status === where.status : true))
          .filter((ticket) => (where.priority ? ticket.priority === where.priority : true))
          .filter((ticket) =>
            where.assigneeUserId !== undefined ? ticket.assigneeUserId === where.assigneeUserId : true,
          )
          .filter((ticket) => matchesTicketCursor(ticket, where.OR))
          .sort(compareTicketsDesc);

        return take === undefined ? records : records.slice(0, take);
      }),
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        return tickets.find((ticket) => ticket.id === where.id && ticket.tenantId === where.tenantId) ?? null;
      }),
      create: vi.fn(({ data }: { data: Partial<TicketRecord> }) => {
        const now = data.createdAt ?? new Date('2026-05-26T12:00:00.000Z');
        const ticket = createTicketRecord({
          id: `33333333-3333-4333-8333-${String(++ticketIdSequence).padStart(12, '0')}`,
          tenantId: data.tenantId!,
          requesterId: data.requesterId!,
          assigneeUserId: data.assigneeUserId ?? null,
          status: data.status ?? 'NEW',
          priority: data.priority ?? 'NORMAL',
          subject: data.subject!,
          description: data.description!,
          firstResponseDueAt: data.firstResponseDueAt ?? null,
          resolutionDueAt: data.resolutionDueAt ?? null,
          createdAt: now,
          updatedAt: now,
        });
        tickets.push(ticket);
        return ticket;
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<TicketRecord> }) => {
        const index = tickets.findIndex((ticket) => ticket.id === where.id);
        const current = tickets[index]!;
        const updated = {
          ...current,
          ...data,
          updatedAt: new Date('2026-05-26T12:05:00.000Z'),
        };
        tickets[index] = updated;
        return updated;
      }),
    },
    auditLog: {
      create: auditCreate,
      findMany: vi.fn(),
    },
  };
}

describe('TicketsController', () => {
  let app: NestFastifyApplication | undefined;

  beforeEach(async () => {
    ticketIdSequence = 0;
    auditCreate = vi.fn(({ data }) => Promise.resolve({ id: 'audit-id', ...data }));
    slaPolicies = [
      { tenantId: tenantAId, priority: 'LOW', firstResponseMinutes: 1440, resolutionMinutes: 10080 },
      { tenantId: tenantAId, priority: 'NORMAL', firstResponseMinutes: 480, resolutionMinutes: 4320 },
      { tenantId: tenantAId, priority: 'HIGH', firstResponseMinutes: 120, resolutionMinutes: 1440 },
      { tenantId: tenantAId, priority: 'URGENT', firstResponseMinutes: 30, resolutionMinutes: 480 },
      { tenantId: tenantBId, priority: 'HIGH', firstResponseMinutes: 1, resolutionMinutes: 2 },
    ];
    tickets = [
      createTicketRecord({
        id: tenantATicketId,
        tenantId: tenantAId,
        requesterId: tenantARequesterId,
        status: 'OPEN',
        priority: 'NORMAL',
        subject: 'Tenant A ticket',
      }),
      createTicketRecord({
        id: tenantBTicketId,
        tenantId: tenantBId,
        requesterId: tenantBRequesterId,
        status: 'OPEN',
        priority: 'HIGH',
        subject: 'Tenant B ticket',
      }),
    ];

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, AuditModule, DatabaseModule, TenantContextModule, RbacModule, TicketsModule],
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

  it('rejects unauthenticated requests', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets',
    });

    expect(response.statusCode).toBe(401);
  });

  it('lets a viewer read but not mutate tickets', async () => {
    const readResponse = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets',
      headers: authHeaders('clerk_viewer'),
    });
    const createResponse = await app!.inject({
      method: 'POST',
      url: '/api/tenants/tenant-a/tickets',
      headers: authHeaders('clerk_viewer'),
      payload: createPayload(),
    });

    expect(readResponse.statusCode).toBe(200);
    expect(createResponse.statusCode).toBe(403);
  });

  it('rejects suspended tenant members for read and mutation routes', async () => {
    const readResponse = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets',
      headers: authHeaders('clerk_suspended'),
    });
    const updateResponse = await app!.inject({
      method: 'PATCH',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}`,
      headers: authHeaders('clerk_suspended'),
      payload: { subject: 'suspended update' },
    });

    expect(readResponse.statusCode).toBe(403);
    expect(readResponse.json()).toMatchObject({ code: 'TENANT_MEMBERSHIP_REQUIRED' });
    expect(updateResponse.statusCode).toBe(403);
    expect(updateResponse.json()).toMatchObject({ code: 'TENANT_MEMBERSHIP_REQUIRED' });
  });

  it('lets an agent update a ticket when permission exists', async () => {
    const response = await app!.inject({
      method: 'PATCH',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}`,
      headers: authHeaders('clerk_agent'),
      payload: { subject: 'Updated subject' },
    });
    const body = response.json<TicketRecord>();

    expect(response.statusCode).toBe(200);
    expect(body.subject).toBe('Updated subject');
  });

  it('does not let a Tenant A user read a Tenant B ticket', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets/${tenantBTicketId}`,
      headers: authHeaders('clerk_admin'),
    });

    expect(response.statusCode).toBe(404);
  });

  it('does not let a Tenant A user update a Tenant B ticket', async () => {
    const response = await app!.inject({
      method: 'PATCH',
      url: `/api/tenants/tenant-a/tickets/${tenantBTicketId}`,
      headers: authHeaders('clerk_agent'),
      payload: { subject: 'Cross tenant edit' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects invalid status transitions with conflict', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/transition`,
      headers: authHeaders('clerk_agent'),
      payload: { status: 'CLOSED' },
    });

    expect(response.statusCode).toBe(409);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.closedAt).toBeNull();
  });

  it('writes an audit log when creating a ticket', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/tenants/tenant-a/tickets',
      headers: authHeaders('clerk_admin'),
      payload: createPayload(),
    });

    expect(response.statusCode).toBe(201);
    expect(lastAuditData()).toMatchObject({
      tenantId: tenantAId,
      actorUserId: adminUserId,
      action: 'ticket.created',
    });
  });

  it.each([
    ['LOW', 1440, 10080],
    ['NORMAL', 480, 4320],
    ['HIGH', 120, 1440],
    ['URGENT', 30, 480],
  ] as const)(
    'assigns SLA deadlines when creating a %s ticket',
    async (priority, firstResponseMinutes, resolutionMinutes) => {
      const response = await app!.inject({
        method: 'POST',
        url: '/api/tenants/tenant-a/tickets',
        headers: authHeaders('clerk_admin'),
        payload: createPayload({ priority }),
      });
      const body = response.json<TicketRecord>();
      const firstResponseDueAt = addMinutesIso(body.createdAt, firstResponseMinutes);
      const resolutionDueAt = addMinutesIso(body.createdAt, resolutionMinutes);
      const auditData = lastAuditData();

      expect(response.statusCode).toBe(201);
      expect(body.firstResponseDueAt).toBe(firstResponseDueAt);
      expect(body.resolutionDueAt).toBe(resolutionDueAt);
      expect(auditData.after).toMatchObject({
        firstResponseDueAt,
        resolutionDueAt,
      });
    },
  );

  it('rejects ticket creation when the current tenant has no matching SLA policy', async () => {
    slaPolicies = slaPolicies.filter(
      (policy) => !(policy.tenantId === tenantAId && policy.priority === 'HIGH'),
    );

    const response = await app!.inject({
      method: 'POST',
      url: '/api/tenants/tenant-a/tickets',
      headers: authHeaders('clerk_admin'),
      payload: createPayload({ priority: 'HIGH' }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      status: 'error',
      code: 'SLA_POLICY_NOT_FOUND',
    });
    expect(tickets).toHaveLength(2);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('writes an audit log when transitioning a ticket', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/transition`,
      headers: authHeaders('clerk_agent'),
      payload: { status: 'RESOLVED' },
    });

    expect(response.statusCode).toBe(201);
    expect(lastAuditData()).toMatchObject({
      tenantId: tenantAId,
      actorUserId: agentUserId,
      entityId: tenantATicketId,
      action: 'ticket.status_changed',
    });
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.resolvedAt).toBeInstanceOf(Date);
  });

  it('keeps resolved_at when a resolved ticket is reopened', async () => {
    const existingResolvedAt = new Date('2026-05-26T11:00:00.000Z');
    tickets = tickets.map((ticket) =>
      ticket.id === tenantATicketId
        ? { ...ticket, status: 'RESOLVED', resolvedAt: existingResolvedAt }
        : ticket,
    );

    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/transition`,
      headers: authHeaders('clerk_agent'),
      payload: { status: 'OPEN' },
    });

    expect(response.statusCode).toBe(201);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.resolvedAt).toBe(
      existingResolvedAt,
    );
  });

  it('sets closed_at when transitioning a resolved ticket to closed', async () => {
    tickets = tickets.map((ticket) =>
      ticket.id === tenantATicketId ? { ...ticket, status: 'RESOLVED' } : ticket,
    );

    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/transition`,
      headers: authHeaders('clerk_agent'),
      payload: { status: 'CLOSED' },
    });

    expect(response.statusCode).toBe(201);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.closedAt).toBeInstanceOf(Date);
  });

  it('keeps closed_at when a closed ticket is reopened', async () => {
    const existingClosedAt = new Date('2026-05-26T11:30:00.000Z');
    tickets = tickets.map((ticket) =>
      ticket.id === tenantATicketId ? { ...ticket, status: 'CLOSED', closedAt: existingClosedAt } : ticket,
    );

    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/transition`,
      headers: authHeaders('clerk_agent'),
      payload: { status: 'OPEN' },
    });

    expect(response.statusCode).toBe(201);
    expect(tickets.find((ticket) => ticket.id === tenantATicketId)?.closedAt).toBe(existingClosedAt);
  });

  it('writes an audit log when assigning a ticket', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: `/api/tenants/tenant-a/tickets/${tenantATicketId}/assign`,
      headers: authHeaders('clerk_agent'),
      payload: { assigneeUserId: adminUserId },
    });

    expect(response.statusCode).toBe(201);
    expect(lastAuditData()).toMatchObject({
      tenantId: tenantAId,
      actorUserId: agentUserId,
      entityId: tenantATicketId,
      action: 'ticket.assigned',
    });
  });

  it('lists only tickets for the current tenant', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets',
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: TicketRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.tenantId).toBe(tenantAId);
  });

  it('returns a cursor when more ticket rows exist', async () => {
    addTenantATicket({ id: '88888888-8888-4888-8888-888888888889', subject: 'Second ticket' });

    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets?limit=1',
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: TicketRecord[]; nextCursor: string | null; hasMore: boolean }>();

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toEqual(expect.any(String));
  });

  it('uses ticket cursors without duplicating rows', async () => {
    const olderTicket = addTenantATicket({
      id: '88888888-8888-4888-8888-888888888889',
      subject: 'Older ticket',
      createdAt: new Date('2026-05-26T11:00:00.000Z'),
    });
    const newestTicket = tickets.find((ticket) => ticket.id === tenantATicketId)!;
    const cursor = encodeCreatedAtIdCursor(newestTicket);

    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: TicketRecord[]; hasMore: boolean }>();

    expect(response.statusCode).toBe(200);
    expect(body.items.map((ticket) => ticket.id)).toEqual([olderTicket.id]);
    expect(body.hasMore).toBe(false);
  });

  it('orders tickets deterministically when created_at matches', async () => {
    tickets = [
      ...tickets.filter((ticket) => ticket.tenantId !== tenantAId),
      createTicketRecord({
        id: '88888888-8888-4888-8888-888888888881',
        tenantId: tenantAId,
        requesterId: tenantARequesterId,
        subject: 'Lower id same timestamp',
      }),
      createTicketRecord({
        id: '88888888-8888-4888-8888-888888888889',
        tenantId: tenantAId,
        requesterId: tenantARequesterId,
        subject: 'Higher id same timestamp',
      }),
    ];

    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets?limit=2',
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: TicketRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items.map((ticket) => ticket.id)).toEqual([
      '88888888-8888-4888-8888-888888888889',
      '88888888-8888-4888-8888-888888888881',
    ]);
  });

  it('rejects invalid ticket cursors', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/tickets?cursor=not-a-cursor',
      headers: authHeaders('clerk_viewer'),
    });

    expect(response.statusCode).toBe(400);
  });

  it('preserves ticket filters while paging', async () => {
    addTenantATicket({
      id: '88888888-8888-4888-8888-888888888889',
      status: 'OPEN',
      priority: 'HIGH',
      assigneeUserId: adminUserId,
      subject: 'Filtered ticket',
    });
    addTenantATicket({
      id: '88888888-8888-4888-8888-888888888880',
      status: 'NEW',
      priority: 'LOW',
      subject: 'Unmatched ticket',
    });

    const response = await app!.inject({
      method: 'GET',
      url: `/api/tenants/tenant-a/tickets?status=OPEN&priority=HIGH&assigneeUserId=${adminUserId}`,
      headers: authHeaders('clerk_viewer'),
    });
    const body = response.json<{ items: TicketRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      status: 'OPEN',
      priority: 'HIGH',
      assigneeUserId: adminUserId,
    });
  });

  it('does not carry admin permissions from Tenant A into Tenant B', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/tenants/tenant-b/tickets',
      headers: authHeaders('clerk_admin'),
      payload: {
        ...createPayload(),
        requesterId: tenantBRequesterId,
      },
    });

    expect(response.statusCode).toBe(403);
  });
});

function authHeaders(providerUserId: string) {
  return { 'x-test-provider-user-id': providerUserId };
}

function createPayload(overrides: Partial<CreateTicketPayload> = {}): CreateTicketPayload {
  return {
    requesterId: tenantARequesterId,
    priority: 'HIGH',
    subject: 'New API ticket',
    description: 'Ticket created through the API test.',
    ...overrides,
  };
}

function lastAuditData() {
  const calls = auditCreate.mock.calls as Array<[{ data: Record<string, unknown> }]>;
  return calls[calls.length - 1]![0].data;
}

type TicketWhere = Partial<TicketRecord> & {
  OR?: Array<{ createdAt: { lt: Date } } | { createdAt: Date; id: { lt: string } }>;
};

function matchesTicketCursor(ticket: TicketRecord, cursorConditions: TicketWhere['OR']) {
  if (!cursorConditions) {
    return true;
  }

  return cursorConditions.some((condition) => {
    if ('id' in condition) {
      return ticket.createdAt.getTime() === condition.createdAt.getTime() && ticket.id < condition.id.lt;
    }

    return ticket.createdAt.getTime() < condition.createdAt.lt.getTime();
  });
}

function compareTicketsDesc(left: TicketRecord, right: TicketRecord) {
  const createdAtCompare = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  return right.id.localeCompare(left.id);
}

function addTenantATicket(input: Partial<TicketRecord> & Pick<TicketRecord, 'id'>) {
  const ticket = createTicketRecord({
    tenantId: tenantAId,
    requesterId: tenantARequesterId,
    ...input,
  });
  tickets.push(ticket);
  return ticket;
}

function createTicketRecord(
  input: Partial<TicketRecord> & Pick<TicketRecord, 'id' | 'tenantId' | 'requesterId'>,
): TicketRecord {
  const now = new Date('2026-05-26T12:00:00.000Z');

  return {
    assigneeUserId: null,
    status: 'NEW',
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

function addMinutesIso(value: Date | string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}
