import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { PrismaClient } from '@triageflow/db';

import { AppModule } from '../app.module';
import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from '../auth/auth.types';

export const ids = {
  tenantA: '00000000-0000-4000-8000-000000000001',
  tenantB: '00000000-0000-4000-8000-000000000002',
  ownerA: '00000000-0000-4000-8000-000000000011',
  viewerA: '00000000-0000-4000-8000-000000000012',
  agentA: '00000000-0000-4000-8000-000000000013',
  noMembership: '00000000-0000-4000-8000-000000000014',
  scopedB: '00000000-0000-4000-8000-000000000015',
  requesterA: '00000000-0000-4000-8000-000000000021',
  requesterB: '00000000-0000-4000-8000-000000000022',
  ownerRoleA: '00000000-0000-4000-8000-000000000041',
  viewerRoleA: '00000000-0000-4000-8000-000000000042',
  agentRoleA: '00000000-0000-4000-8000-000000000043',
  viewerRoleB: '00000000-0000-4000-8000-000000000044',
  ticketA1: '00000000-0000-4000-8000-000000000101',
  ticketA2: '00000000-0000-4000-8000-000000000102',
  ticketA3: '00000000-0000-4000-8000-000000000103',
  ticketB1: '00000000-0000-4000-8000-000000000201',
};

const allPermissions = [
  'ticket:read',
  'ticket:create',
  'ticket:update',
  'ticket:assign',
  'comment:create_public',
  'comment:create_internal',
  'comment:read_internal',
  'analytics:read',
];

const testAuthProvider: AuthIdentityProvider = {
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

export async function createLiveApiApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AUTH_IDENTITY_PROVIDER)
    .useValue(testAuthProvider)
    .compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export function authHeaders(providerUserId: string) {
  return {
    'x-test-provider-user-id': providerUserId,
  };
}

export async function resetAndSeed(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "analytics_daily_rollups", "audit_logs", "ticket_comments", "sla_breaches", "tickets", "sla_policies", "requesters", "memberships", "role_permissions", "roles", "permissions", "users", "tenants" RESTART IDENTITY CASCADE',
  );

  await prisma.permission.createMany({
    data: allPermissions.map((key) => ({ key, description: `${key} permission` })),
  });
  const permissions = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));

  await prisma.tenant.createMany({
    data: [
      { id: ids.tenantA, slug: 'tenant-a', name: 'Tenant A' },
      { id: ids.tenantB, slug: 'tenant-b', name: 'Tenant B' },
    ],
  });

  await prisma.user.createMany({
    data: [
      {
        id: ids.ownerA,
        clerkAuthProviderId: 'clerk_owner_a',
        email: 'owner-a@example.com',
        displayName: 'Owner A',
      },
      {
        id: ids.viewerA,
        clerkAuthProviderId: 'clerk_viewer_a',
        email: 'viewer-a@example.com',
        displayName: 'Viewer A',
      },
      {
        id: ids.agentA,
        clerkAuthProviderId: 'clerk_agent_a',
        email: 'agent-a@example.com',
        displayName: 'Agent A',
      },
      {
        id: ids.noMembership,
        clerkAuthProviderId: 'clerk_no_membership',
        email: 'nomembership@example.com',
        displayName: 'No Membership',
      },
      {
        id: ids.scopedB,
        clerkAuthProviderId: 'clerk_scoped_b',
        email: 'scoped-b@example.com',
        displayName: 'Scoped B',
      },
    ],
  });

  await createRole(prisma, permissionIdByKey, ids.tenantA, ids.ownerRoleA, 'owner', allPermissions);
  await createRole(prisma, permissionIdByKey, ids.tenantA, ids.viewerRoleA, 'viewer', ['ticket:read']);
  await createRole(prisma, permissionIdByKey, ids.tenantA, ids.agentRoleA, 'agent', [
    'ticket:read',
    'ticket:update',
    'ticket:assign',
    'comment:create_public',
    'comment:create_internal',
    'comment:read_internal',
  ]);
  await createRole(prisma, permissionIdByKey, ids.tenantB, ids.viewerRoleB, 'viewer', ['ticket:read']);

  await prisma.membership.createMany({
    data: [
      {
        id: '00000000-0000-4000-8000-000000000031',
        tenantId: ids.tenantA,
        userId: ids.ownerA,
        roleId: ids.ownerRoleA,
      },
      {
        id: '00000000-0000-4000-8000-000000000032',
        tenantId: ids.tenantA,
        userId: ids.viewerA,
        roleId: ids.viewerRoleA,
      },
      {
        id: '00000000-0000-4000-8000-000000000033',
        tenantId: ids.tenantA,
        userId: ids.agentA,
        roleId: ids.agentRoleA,
      },
      {
        id: '00000000-0000-4000-8000-000000000034',
        tenantId: ids.tenantB,
        userId: ids.scopedB,
        roleId: ids.viewerRoleB,
      },
    ],
  });

  await prisma.requester.createMany({
    data: [
      { id: ids.requesterA, tenantId: ids.tenantA, email: 'requester-a@example.com', name: 'Requester A' },
      { id: ids.requesterB, tenantId: ids.tenantB, email: 'requester-b@example.com', name: 'Requester B' },
    ],
  });

  await prisma.slaPolicy.createMany({
    data: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].flatMap((priority) => [
      {
        tenantId: ids.tenantA,
        name: `${priority} policy A`,
        priority: priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
        firstResponseMinutes: 60,
        resolutionMinutes: 240,
        isDefault: true,
      },
      {
        tenantId: ids.tenantB,
        name: `${priority} policy B`,
        priority: priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
        firstResponseMinutes: 60,
        resolutionMinutes: 240,
        isDefault: true,
      },
    ]),
  });

  const sameCreatedAt = new Date('2026-05-26T10:00:00.000Z');
  await prisma.ticket.createMany({
    data: [
      ticket(ids.ticketA1, ids.tenantA, ids.requesterA, 'A high one', 'HIGH', 'OPEN', sameCreatedAt, ids.agentA),
      ticket(ids.ticketA2, ids.tenantA, ids.requesterA, 'A normal two', 'NORMAL', 'NEW', sameCreatedAt, null),
      ticket(ids.ticketA3, ids.tenantA, ids.requesterA, 'A normal three', 'NORMAL', 'OPEN', sameCreatedAt, ids.agentA),
      ticket(ids.ticketB1, ids.tenantB, ids.requesterB, 'B ticket', 'NORMAL', 'OPEN', sameCreatedAt, ids.scopedB),
    ],
  });

  await prisma.ticketComment.createMany({
    data: [
      comment('00000000-0000-4000-8000-000000000301', ids.tenantA, ids.ticketA1, ids.ownerA, 'PUBLIC', 'public 1'),
      comment('00000000-0000-4000-8000-000000000302', ids.tenantA, ids.ticketA1, ids.ownerA, 'INTERNAL', 'internal 2'),
      comment('00000000-0000-4000-8000-000000000303', ids.tenantA, ids.ticketA1, ids.ownerA, 'PUBLIC', 'public 3'),
      comment('00000000-0000-4000-8000-000000000304', ids.tenantB, ids.ticketB1, ids.scopedB, 'PUBLIC', 'tenant b public'),
    ],
  });

  await prisma.analyticsDailyRollup.create({
    data: {
      tenantId: ids.tenantA,
      date: new Date('2026-05-26T00:00:00.000Z'),
      openedCount: 3,
      resolvedCount: 0,
      closedCount: 0,
      publicCommentCount: 2,
      internalNoteCount: 1,
      firstResponseSlaBreachCount: 0,
      resolutionSlaBreachCount: 0,
    },
  });
}

async function createRole(
  prisma: PrismaClient,
  permissionIdByKey: Map<string, string>,
  tenantId: string,
  id: string,
  key: string,
  permissionKeys: string[],
) {
  await prisma.role.create({
    data: {
      id,
      tenantId,
      key,
      name: key,
    },
  });

  await prisma.rolePermission.createMany({
    data: permissionKeys.map((permissionKey) => ({
      tenantId,
      roleId: id,
      permissionId: permissionIdByKey.get(permissionKey)!,
    })),
  });
}

function ticket(
  id: string,
  tenantId: string,
  requesterId: string,
  subject: string,
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
  status: 'NEW' | 'OPEN' | 'PENDING_CUSTOMER' | 'PENDING_INTERNAL' | 'RESOLVED' | 'CLOSED',
  createdAt: Date,
  assigneeUserId: string | null,
) {
  return {
    id,
    tenantId,
    requesterId,
    assigneeUserId,
    status,
    priority,
    subject,
    description: `${subject} description`,
    firstResponseDueAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
    resolutionDueAt: new Date(createdAt.getTime() + 240 * 60 * 1000),
    createdAt,
  };
}

function comment(
  id: string,
  tenantId: string,
  ticketId: string,
  authorUserId: string,
  visibility: 'PUBLIC' | 'INTERNAL',
  body: string,
) {
  return {
    id,
    tenantId,
    ticketId,
    authorUserId,
    visibility,
    body,
    createdAt: new Date('2026-05-26T11:00:00.000Z'),
  };
}
