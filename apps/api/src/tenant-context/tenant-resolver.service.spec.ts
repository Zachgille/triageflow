import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { setAuthIdentity } from '../auth/request-auth';
import { PrismaService } from '../database/prisma.service';
import { TenantResolver } from './tenant-resolver.service';

const tenant = { id: 'tenant-a-id' };
const user = { id: 'user-a-id' };

describe('TenantResolver', () => {
  it('creates request context for active tenant memberships', async () => {
    const prisma = createMockPrisma({
      membership: createMembership('membership-active', ['ticket:read']),
    });
    const resolver = new TenantResolver(prisma as unknown as PrismaService);

    const context = await resolver.resolve(authenticatedRequest('clerk_user'), 'tenant-a');

    expect(context).toEqual({
      requestId: 'request-id',
      userId: user.id,
      tenantId: tenant.id,
      membershipId: 'membership-active',
      permissions: ['ticket:read'],
    });
    expect(prisma.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: tenant.id,
          userId: user.id,
          status: 'ACTIVE',
        },
      }),
    );
  });

  it('rejects suspended tenant memberships as missing valid access', async () => {
    const prisma = createMockPrisma({ membership: null });
    const resolver = new TenantResolver(prisma as unknown as PrismaService);

    await expectTenantMembershipRequired(resolver.resolve(authenticatedRequest('clerk_suspended'), 'tenant-a'));
  });

  it('preserves existing denial for authenticated users without tenant membership', async () => {
    const prisma = createMockPrisma({ membership: null });
    const resolver = new TenantResolver(prisma as unknown as PrismaService);

    await expect(resolver.resolve(authenticatedRequest('clerk_outside'), 'tenant-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('preserves not-found behavior for unknown tenant slugs', async () => {
    const prisma = createMockPrisma({ tenantRecord: null });
    const resolver = new TenantResolver(prisma as unknown as PrismaService);

    await expect(resolver.resolve(authenticatedRequest('clerk_user'), 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function authenticatedRequest(providerUserId: string) {
  const request = { id: 'request-id' } as FastifyRequest;
  setAuthIdentity(request, {
    provider: 'clerk',
    providerUserId,
  });
  return request;
}

async function expectTenantMembershipRequired(promise: Promise<unknown>) {
  try {
    await promise;
    throw new Error('Expected tenant membership resolution to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'TENANT_MEMBERSHIP_REQUIRED',
    });
  }
}

function createMockPrisma({
  tenantRecord = tenant,
  membership = createMembership('membership-active', ['ticket:read']),
}: {
  tenantRecord?: typeof tenant | null;
  membership?: ReturnType<typeof createMembership> | null;
} = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenantRecord),
    },
    membership: {
      findFirst: vi.fn().mockResolvedValue(membership),
    },
  };
}

function createMembership(id: string, permissions: string[]) {
  return {
    id,
    role: {
      rolePermissions: permissions.map((permission) => ({
        permission: { key: permission },
      })),
    },
  };
}
