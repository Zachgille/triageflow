import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from '../auth/auth.types';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { RbacModule } from '../rbac/rbac.module';
import { AppConfigService } from '../runtime-config/app-config.service';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { DebugModule } from './debug.module';

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
  permissions: string[];
};

const tenants: TenantRecord[] = [
  { id: 'tenant-a-id', slug: 'tenant-a' },
  { id: 'tenant-b-id', slug: 'tenant-b' },
];

const users: UserRecord[] = [
  { id: 'owner-user-id', clerkAuthProviderId: 'clerk_owner' },
  { id: 'viewer-user-id', clerkAuthProviderId: 'clerk_viewer' },
  { id: 'outside-user-id', clerkAuthProviderId: 'clerk_outside' },
];

const memberships: MembershipRecord[] = [
  {
    id: 'membership-owner-a',
    tenantId: 'tenant-a-id',
    userId: 'owner-user-id',
    permissions: ['tenant.manage'],
  },
  {
    id: 'membership-owner-b',
    tenantId: 'tenant-b-id',
    userId: 'owner-user-id',
    permissions: ['tickets.read'],
  },
  {
    id: 'membership-viewer-a',
    tenantId: 'tenant-a-id',
    userId: 'viewer-user-id',
    permissions: ['tickets.read'],
  },
];

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

const mockPrisma = {
  user: {
    findUnique: ({ where }: { where: { clerkAuthProviderId: string } }) => {
      return users.find((user) => user.clerkAuthProviderId === where.clerkAuthProviderId) ?? null;
    },
  },
  tenant: {
    findUnique: ({ where }: { where: { slug: string } }) => {
      return tenants.find((tenant) => tenant.slug === where.slug) ?? null;
    },
  },
  membership: {
    findUnique: ({
      where,
    }: {
      where: { tenantId_userId: { tenantId: string; userId: string } };
    }) => {
      const membership = memberships.find(
        (candidate) =>
          candidate.tenantId === where.tenantId_userId.tenantId &&
          candidate.userId === where.tenantId_userId.userId,
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
    },
  },
};

describe('DebugContextController authorization foundation', () => {
  let app: NestFastifyApplication | undefined;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, DatabaseModule, TenantContextModule, RbacModule, DebugModule],
    })
      .overrideProvider(AUTH_IDENTITY_PROVIDER)
      .useValue(mockIdentityProvider)
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
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
      url: '/api/tenants/tenant-a/_debug/context',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects authenticated users without tenant membership', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/_debug/context',
      headers: { 'x-test-provider-user-id': 'clerk_outside' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a tenant member with the required permission', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/_debug/context',
      headers: { 'x-test-provider-user-id': 'clerk_owner' },
    });
    const body = response.json<{ requestContext: { tenantId: string; permissions: string[] } }>();

    expect(response.statusCode).toBe(200);
    expect(body.requestContext.tenantId).toBe('tenant-a-id');
    expect(body.requestContext.permissions).toContain('tenant.manage');
  });

  it('does not carry admin permissions across tenants', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-b/_debug/context',
      headers: { 'x-test-provider-user-id': 'clerk_owner' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects tenant members missing the required permission', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/_debug/context',
      headers: { 'x-test-provider-user-id': 'clerk_viewer' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('does not expose the debug endpoint in production', async () => {
    await app?.close();

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, DatabaseModule, TenantContextModule, RbacModule, DebugModule],
    })
      .overrideProvider(AUTH_IDENTITY_PROVIDER)
      .useValue(mockIdentityProvider)
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(AppConfigService)
      .useValue({
        values: {
          NODE_ENV: 'production',
        },
      })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/tenants/tenant-a/_debug/context',
      headers: { 'x-test-provider-user-id': 'clerk_owner' },
    });

    expect(response.statusCode).toBe(404);
  });
});
