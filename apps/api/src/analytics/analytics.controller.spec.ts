import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from '../auth/auth.types';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { RbacModule } from '../rbac/rbac.module';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AnalyticsModule } from './analytics.module';

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
  status: 'ACTIVE';
  permissions: string[];
};

type TicketRecord = {
  tenantId: string;
  status: 'NEW' | 'OPEN' | 'PENDING_CUSTOMER' | 'PENDING_INTERNAL' | 'RESOLVED' | 'CLOSED';
  createdAt: Date;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
};

type SlaBreachRecord = {
  tenantId: string;
  acknowledgedAt: Date | null;
};

type RollupRecord = {
  id: string;
  tenantId: string;
  date: Date;
  openedCount: number;
  resolvedCount: number;
  closedCount: number;
  publicCommentCount: number;
  internalNoteCount: number;
  firstResponseSlaBreachCount: number;
  resolutionSlaBreachCount: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const tenantAId = '11111111-1111-4111-8111-111111111111';
const tenantBId = '22222222-2222-4222-8222-222222222222';
const ownerUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const adminUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const agentUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const noMembershipUserId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const tenants: TenantRecord[] = [
  { id: tenantAId, slug: 'tenant-a' },
  { id: tenantBId, slug: 'tenant-b' },
];

const users: UserRecord[] = [
  { id: ownerUserId, clerkAuthProviderId: 'clerk_owner' },
  { id: adminUserId, clerkAuthProviderId: 'clerk_admin' },
  { id: agentUserId, clerkAuthProviderId: 'clerk_agent' },
  { id: noMembershipUserId, clerkAuthProviderId: 'clerk_no_membership' },
];

const memberships: MembershipRecord[] = [
  {
    id: 'membership-owner-a',
    tenantId: tenantAId,
    userId: ownerUserId,
    status: 'ACTIVE',
    permissions: ['analytics:read', 'comment:read_internal'],
  },
  {
    id: 'membership-admin-a',
    tenantId: tenantAId,
    userId: adminUserId,
    status: 'ACTIVE',
    permissions: ['analytics:read'],
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
    permissions: ['ticket:read'],
  },
];

let tickets: TicketRecord[];
let slaBreaches: SlaBreachRecord[];
let rollups: RollupRecord[];

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
    user: {
      findUnique: vi.fn(({ where }: { where: { clerkAuthProviderId: string } }) => {
        const user = users.find((candidate) => candidate.clerkAuthProviderId === where.clerkAuthProviderId);
        return user ? { id: user.id } : null;
      }),
    },
    tenant: {
      findUnique: vi.fn(({ where }: { where: { slug: string } }) => {
        const tenant = tenants.find((candidate) => candidate.slug === where.slug);
        return tenant ? { id: tenant.id } : null;
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
    },
    ticket: {
      count: vi.fn(({ where }: { where: { tenantId: string; status?: TicketRecord['status'] } }) => {
        return tickets.filter((ticket) => {
          if (ticket.tenantId !== where.tenantId) {
            return false;
          }

          return where.status ? ticket.status === where.status : true;
        }).length;
      }),
      findMany: vi.fn(
        ({
          where,
        }: {
          where: {
            tenantId: string;
            firstRespondedAt?: { not: null };
            resolvedAt?: { not: null };
          };
        }) => {
          return tickets
            .filter((ticket) => ticket.tenantId === where.tenantId)
            .filter((ticket) =>
              where.firstRespondedAt ? ticket.firstRespondedAt !== null : true,
            )
            .filter((ticket) => (where.resolvedAt ? ticket.resolvedAt !== null : true))
            .map((ticket) => ({
              createdAt: ticket.createdAt,
              firstRespondedAt: ticket.firstRespondedAt,
              resolvedAt: ticket.resolvedAt,
            }));
        },
      ),
    },
    slaBreach: {
      count: vi.fn(({ where }: { where: { tenantId: string; acknowledgedAt?: null } }) => {
        return slaBreaches.filter((breach) => {
          if (breach.tenantId !== where.tenantId) {
            return false;
          }

          return Object.prototype.hasOwnProperty.call(where, 'acknowledgedAt')
            ? breach.acknowledgedAt === null
            : true;
        }).length;
      }),
    },
    analyticsDailyRollup: {
      findMany: vi.fn(
        ({
          where,
        }: {
          where: { tenantId: string; date: { gte: Date; lte: Date } };
          orderBy: { date: 'asc' };
        }) => {
          return rollups
            .filter((rollup) => rollup.tenantId === where.tenantId)
            .filter(
              (rollup) =>
                rollup.date.getTime() >= where.date.gte.getTime() &&
                rollup.date.getTime() <= where.date.lte.getTime(),
            )
            .sort((left, right) => left.date.getTime() - right.date.getTime());
        },
      ),
    },
  };
}

describe('AnalyticsController', () => {
  let app: NestFastifyApplication | undefined;

  beforeEach(async () => {
    tickets = [
      createTicket({ tenantId: tenantAId, status: 'NEW' }),
      createTicket({ tenantId: tenantAId, status: 'OPEN' }),
      createTicket({ tenantId: tenantAId, status: 'PENDING_CUSTOMER' }),
      createTicket({ tenantId: tenantAId, status: 'PENDING_INTERNAL' }),
      createTicket({
        tenantId: tenantAId,
        status: 'RESOLVED',
        resolvedAt: new Date('2026-05-26T12:00:00.000Z'),
      }),
      createTicket({ tenantId: tenantAId, status: 'CLOSED' }),
      createTicket({ tenantId: tenantBId, status: 'OPEN' }),
    ];
    slaBreaches = [
      { tenantId: tenantAId, acknowledgedAt: null },
      { tenantId: tenantAId, acknowledgedAt: new Date('2026-05-26T12:00:00.000Z') },
      { tenantId: tenantBId, acknowledgedAt: null },
    ];
    rollups = [
      createRollup({ id: 'rollup-a-1', tenantId: tenantAId, date: new Date('2026-05-25T00:00:00.000Z') }),
      createRollup({ id: 'rollup-a-2', tenantId: tenantAId, date: new Date('2026-05-26T00:00:00.000Z') }),
      createRollup({ id: 'rollup-b-1', tenantId: tenantBId, date: new Date('2026-05-26T00:00:00.000Z') }),
    ];

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, DatabaseModule, TenantContextModule, RbacModule, AnalyticsModule],
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
      url: '/api/tenants/tenant-a/analytics/overview',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects users without tenant membership', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/overview',
      headers: authHeaders('clerk_no_membership'),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'TENANT_MEMBERSHIP_REQUIRED' });
  });

  it('rejects users without analytics:read', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/overview',
      headers: authHeaders('clerk_agent'),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'PERMISSION_REQUIRED' });
  });

  it('lets owners read tenant overview', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/overview',
      headers: authHeaders('clerk_owner'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      newTicketCount: 1,
      openTicketCount: 1,
      pendingTicketCount: 2,
      resolvedTicketCount: 1,
      closedTicketCount: 1,
      totalSlaBreachCount: 2,
      unresolvedSlaBreachCount: 1,
    });
  });

  it('uses tenant-specific permissions', async () => {
    const tenantAResponse = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/overview',
      headers: authHeaders('clerk_admin'),
    });
    const tenantBResponse = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-b/analytics/overview',
      headers: authHeaders('clerk_admin'),
    });

    expect(tenantAResponse.statusCode).toBe(200);
    expect(tenantBResponse.statusCode).toBe(403);
  });

  it('redacts internal note counts for analytics readers without internal-note read permission', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=2026-05-25&to=2026-05-26',
      headers: authHeaders('clerk_admin'),
    });
    const body = response.json<{ data: Array<Omit<RollupRecord, 'internalNoteCount'>> }>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      id: 'rollup-a-1',
      openedCount: 1,
      publicCommentCount: 4,
    });
    expect(body.data[0]).not.toHaveProperty('internalNoteCount');
    expect(body.data[1]).not.toHaveProperty('internalNoteCount');
  });

  it('returns internal note counts for analytics readers with internal-note read permission', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=2026-05-25&to=2026-05-26',
      headers: authHeaders('clerk_owner'),
    });
    const body = response.json<{ data: RollupRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data.map((rollup) => rollup.internalNoteCount)).toEqual([5, 5]);
  });

  it('returns empty daily rollups when no rows exist for the range', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=2026-04-01&to=2026-04-02',
      headers: authHeaders('clerk_admin'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });
  });

  it('rejects invalid daily rollup date format', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=05-25-2026&to=2026-05-26',
      headers: authHeaders('clerk_admin'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects daily rollup ranges where from is after to', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=2026-05-27&to=2026-05-26',
      headers: authHeaders('clerk_admin'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects too-large daily rollup ranges', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=2026-01-01&to=2026-04-01',
      headers: authHeaders('clerk_admin'),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('never returns another tenant rollups', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/analytics/daily-rollups?from=2026-05-26&to=2026-05-26',
      headers: authHeaders('clerk_admin'),
    });
    const body = response.json<{ data: RollupRecord[] }>();

    expect(response.statusCode).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.id).toBe('rollup-a-2');
  });
});

function authHeaders(providerUserId: string) {
  return { 'x-test-provider-user-id': providerUserId };
}

function createTicket(input: Partial<TicketRecord> & Pick<TicketRecord, 'tenantId' | 'status'>): TicketRecord {
  return {
    createdAt: new Date('2026-05-26T10:00:00.000Z'),
    firstRespondedAt: null,
    resolvedAt: null,
    ...input,
  };
}

function createRollup(input: Pick<RollupRecord, 'id' | 'tenantId' | 'date'>): RollupRecord {
  return {
    openedCount: 1,
    resolvedCount: 2,
    closedCount: 3,
    publicCommentCount: 4,
    internalNoteCount: 5,
    firstResponseSlaBreachCount: 6,
    resolutionSlaBreachCount: 7,
    avgFirstResponseSeconds: 60,
    avgResolutionSeconds: 120,
    createdAt: new Date('2026-05-26T12:00:00.000Z'),
    updatedAt: new Date('2026-05-26T12:00:00.000Z'),
    ...input,
  };
}
