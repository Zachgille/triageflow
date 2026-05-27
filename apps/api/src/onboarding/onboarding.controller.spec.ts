import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthModule } from '../auth/auth.module';
import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from '../auth/auth.types';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { OnboardingModule } from './onboarding.module';

type UserRecord = {
  id: string;
  clerkAuthProviderId: string;
  email: string;
  displayName: string;
};

type TenantRecord = {
  id: string;
  slug: string;
  name: string;
};

type RoleRecord = {
  id: string;
  tenantId: string;
  key: string;
  name: string;
};

type PermissionRecord = {
  id: string;
  key: string;
  description: string | undefined;
};

type MembershipRecord = {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  status: 'ACTIVE' | 'SUSPENDED';
};

type RolePermissionRecord = {
  tenantId: string;
  roleId: string;
  permissionId: string;
};

type CurrentUserResponse = {
  status: 'ok';
  user: {
    id: string;
    providerUserId: string;
    email: string;
    displayName: string;
  };
  memberships: Array<{
    id: string;
    status: string;
    tenant: {
      id: string;
      slug: string;
      name: string;
    };
    role: {
      id: string;
      key: string;
      name: string;
    };
    permissions: string[];
  }>;
};

let users: UserRecord[];
let tenants: TenantRecord[];
let roles: RoleRecord[];
let permissions: PermissionRecord[];
let memberships: MembershipRecord[];
let rolePermissions: RolePermissionRecord[];
let userSequence: number;
let tenantSequence: number;
let roleSequence: number;
let permissionSequence: number;
let membershipSequence: number;
let transactionSpy: ReturnType<typeof vi.fn>;

const mockIdentityProvider: AuthIdentityProvider = {
  authenticate(request: FastifyRequest) {
    const providerUserId = request.headers['x-test-provider-user-id'];

    if (typeof providerUserId !== 'string') {
      return null;
    }

    const email = request.headers['x-test-email'];
    const displayName = request.headers['x-test-display-name'];

    return {
      provider: 'clerk',
      providerUserId,
      ...(typeof email === 'string' ? { email } : {}),
      ...(typeof displayName === 'string' ? { displayName } : {}),
    };
  },
};

function createMockPrisma() {
  const db = {
    $transaction: transactionSpy.mockImplementation((callback: (client: PrismaService) => unknown) => {
      return callback(db as unknown as PrismaService);
    }),
    user: {
      findUnique: vi.fn(({ where }: { where: { clerkAuthProviderId?: string; email?: string } }) => {
        if (where.clerkAuthProviderId) {
          const user = users.find((candidate) => candidate.clerkAuthProviderId === where.clerkAuthProviderId);
          return user ? hydrateUser(user) : null;
        }

        if (where.email) {
          return users.find((candidate) => candidate.email === where.email) ?? null;
        }

        return null;
      }),
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { clerkAuthProviderId: string };
          create: Omit<UserRecord, 'id'>;
          update: Pick<UserRecord, 'email' | 'displayName'>;
        }) => {
          const existing = users.find((candidate) => candidate.clerkAuthProviderId === where.clerkAuthProviderId);

          if (existing) {
            existing.email = update.email;
            existing.displayName = update.displayName;
            return existing;
          }

          const user = {
            id: `user-${++userSequence}`,
            ...create,
          };
          users.push(user);
          return user;
        },
      ),
    },
    tenant: {
      findUnique: vi.fn(({ where }: { where: { slug: string } }) => {
        return tenants.find((tenant) => tenant.slug === where.slug) ?? null;
      }),
      create: vi.fn(({ data }: { data: Pick<TenantRecord, 'name' | 'slug'> }) => {
        const tenant = {
          id: `tenant-${++tenantSequence}`,
          name: data.name,
          slug: data.slug,
        };
        tenants.push(tenant);
        return tenant;
      }),
    },
    permission: {
      upsert: vi.fn(
        ({
          where,
          create,
          update,
        }: {
          where: { key: string };
          create: Pick<PermissionRecord, 'key' | 'description'>;
          update: Pick<PermissionRecord, 'description'>;
        }) => {
          const existing = permissions.find((permission) => permission.key === where.key);

          if (existing) {
            existing.description = update.description;
            return existing;
          }

          const permission = {
            id: `permission-${++permissionSequence}`,
            key: create.key,
            description: create.description,
          };
          permissions.push(permission);
          return permission;
        },
      ),
    },
    role: {
      create: vi.fn(({ data }: { data: Pick<RoleRecord, 'tenantId' | 'key' | 'name'> }) => {
        const role = {
          id: `role-${++roleSequence}`,
          tenantId: data.tenantId,
          key: data.key,
          name: data.name,
        };
        roles.push(role);
        return role;
      }),
    },
    rolePermission: {
      createMany: vi.fn(({ data }: { data: RolePermissionRecord[] }) => {
        for (const record of data) {
          const exists = rolePermissions.some(
            (candidate) =>
              candidate.tenantId === record.tenantId &&
              candidate.roleId === record.roleId &&
              candidate.permissionId === record.permissionId,
          );

          if (!exists) {
            rolePermissions.push(record);
          }
        }

        return { count: data.length };
      }),
    },
    membership: {
      create: vi.fn(({ data }: { data: Omit<MembershipRecord, 'id'> }) => {
        const membership = {
          id: `membership-${++membershipSequence}`,
          ...data,
        };
        memberships.push(membership);
        return membership;
      }),
    },
  };

  return db;
}

describe('OnboardingController', () => {
  let app: NestFastifyApplication | undefined;

  beforeEach(async () => {
    users = [];
    tenants = [{ id: 'tenant-existing', slug: 'existing', name: 'Existing Tenant' }];
    roles = [];
    permissions = [];
    memberships = [];
    rolePermissions = [];
    userSequence = 0;
    tenantSequence = 0;
    roleSequence = 0;
    permissionSequence = 0;
    membershipSequence = 0;
    transactionSpy = vi.fn();

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, DatabaseModule, OnboardingModule],
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

  it('returns onboarding required when Clerk user has no internal user', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/me',
      headers: authHeaders('clerk_new', 'new@example.com', 'New User'),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'onboarding_required',
      code: 'APPLICATION_USER_NOT_FOUND',
      providerUserId: 'clerk_new',
      email: 'new@example.com',
      displayName: 'New User',
    });
  });

  it('creates an internal user from Clerk identity', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/onboarding/profile',
      headers: authHeaders('clerk_new', 'new@example.com', 'New User'),
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(users).toHaveLength(1);
    expect(response.json()).toMatchObject({
      status: 'ok',
      user: {
        providerUserId: 'clerk_new',
        email: 'new@example.com',
        displayName: 'New User',
      },
      memberships: [],
    });
  });

  it('is idempotent when completing a profile repeatedly', async () => {
    await app!.inject({
      method: 'POST',
      url: '/api/onboarding/profile',
      headers: authHeaders('clerk_new', 'new@example.com', 'New User'),
      payload: {},
    });
    const response = await app!.inject({
      method: 'POST',
      url: '/api/onboarding/profile',
      headers: authHeaders('clerk_new', 'new@example.com', 'New User'),
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(users).toHaveLength(1);
  });

  it('creates a tenant and owner membership transactionally', async () => {
    users.push({
      id: 'user-existing',
      clerkAuthProviderId: 'clerk_owner',
      email: 'owner@example.com',
      displayName: 'Owner',
    });

    const response = await app!.inject({
      method: 'POST',
      url: '/api/onboarding/tenant',
      headers: authHeaders('clerk_owner'),
      payload: {
        name: 'Acme Support',
        slug: 'acme-support',
      },
    });

    const body = response.json<CurrentUserResponse>();
    const createdTenant = tenants.find((tenant) => tenant.slug === 'acme-support');
    const ownerRole = roles.find((role) => role.tenantId === createdTenant?.id && role.key === 'owner');

    expect(response.statusCode).toBe(201);
    expect(transactionSpy).toHaveBeenCalledOnce();
    expect(createdTenant).toMatchObject({ name: 'Acme Support' });
    expect(ownerRole).toBeDefined();
    expect(memberships).toContainEqual(
      expect.objectContaining({
        tenantId: createdTenant?.id,
        userId: 'user-existing',
        roleId: ownerRole?.id,
        status: 'ACTIVE',
      }),
    );
    expect(body.memberships).toHaveLength(1);
    expect(body.memberships[0]).toMatchObject({
      tenant: { slug: 'acme-support' },
      role: { key: 'owner' },
    });
  });

  it('does not grant access to existing tenants when creating a new tenant', async () => {
    users.push({
      id: 'user-existing',
      clerkAuthProviderId: 'clerk_owner',
      email: 'owner@example.com',
      displayName: 'Owner',
    });

    const response = await app!.inject({
      method: 'POST',
      url: '/api/onboarding/tenant',
      headers: authHeaders('clerk_owner'),
      payload: {
        name: 'New Workspace',
        slug: 'new-workspace',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<CurrentUserResponse>();

    expect(body.memberships.map((membership) => membership.tenant.slug)).toEqual(['new-workspace']);
  });

  it('returns tenant-specific memberships and permissions for multi-tenant users', async () => {
    seedMultiTenantUser();

    const response = await app!.inject({
      method: 'GET',
      url: '/api/me',
      headers: authHeaders('clerk_multi'),
    });
    const body = response.json<CurrentUserResponse>();

    expect(response.statusCode).toBe(200);
    expect(body.memberships).toHaveLength(2);
    const tenantAMembership = body.memberships.find((membership) => membership.tenant.slug === 'tenant-a');
    const tenantBMembership = body.memberships.find((membership) => membership.tenant.slug === 'tenant-b');

    expect(tenantAMembership?.role.key).toBe('owner');
    expect(tenantAMembership?.permissions).toEqual(expect.arrayContaining(['tenant.manage', 'ticket:create']));
    expect(tenantBMembership?.role.key).toBe('viewer');
    expect(tenantBMembership?.permissions).toEqual(['ticket:read']);
  });

  it('rejects duplicate tenant slug cleanly', async () => {
    users.push({
      id: 'user-existing',
      clerkAuthProviderId: 'clerk_owner',
      email: 'owner@example.com',
      displayName: 'Owner',
    });

    const response = await app!.inject({
      method: 'POST',
      url: '/api/onboarding/tenant',
      headers: authHeaders('clerk_owner'),
      payload: {
        name: 'Existing Tenant',
        slug: 'existing',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      status: 'error',
      code: 'TENANT_SLUG_TAKEN',
    });
  });
});

function authHeaders(providerUserId: string, email?: string, displayName?: string) {
  return {
    'x-test-provider-user-id': providerUserId,
    ...(email ? { 'x-test-email': email } : {}),
    ...(displayName ? { 'x-test-display-name': displayName } : {}),
  };
}

function hydrateUser(user: UserRecord) {
  return {
    ...user,
    memberships: memberships
      .filter((membership) => membership.userId === user.id && membership.status === 'ACTIVE')
      .map((membership) => {
        const tenant = tenants.find((candidate) => candidate.id === membership.tenantId)!;
        const role = roles.find((candidate) => candidate.id === membership.roleId)!;
        const hydratedPermissions = rolePermissions
          .filter((rolePermission) => rolePermission.roleId === role.id && rolePermission.tenantId === tenant.id)
          .map((rolePermission) => ({
            permission: {
              key: permissions.find((permission) => permission.id === rolePermission.permissionId)!.key,
            },
          }));

        return {
          id: membership.id,
          status: membership.status,
          tenant,
          role: {
            ...role,
            rolePermissions: hydratedPermissions,
          },
        };
      }),
  };
}

function seedMultiTenantUser() {
  users.push({
    id: 'user-multi',
    clerkAuthProviderId: 'clerk_multi',
    email: 'multi@example.com',
    displayName: 'Multi Tenant User',
  });
  tenants.push(
    { id: 'tenant-a', slug: 'tenant-a', name: 'Tenant A' },
    { id: 'tenant-b', slug: 'tenant-b', name: 'Tenant B' },
  );
  roles.push(
    { id: 'role-owner-a', tenantId: 'tenant-a', key: 'owner', name: 'Owner' },
    { id: 'role-viewer-b', tenantId: 'tenant-b', key: 'viewer', name: 'Viewer' },
  );
  permissions.push(
    { id: 'permission-tenant-manage', key: 'tenant.manage', description: undefined },
    { id: 'permission-ticket-create', key: 'ticket:create', description: undefined },
    { id: 'permission-ticket-read', key: 'ticket:read', description: undefined },
  );
  rolePermissions.push(
    { tenantId: 'tenant-a', roleId: 'role-owner-a', permissionId: 'permission-tenant-manage' },
    { tenantId: 'tenant-a', roleId: 'role-owner-a', permissionId: 'permission-ticket-create' },
    { tenantId: 'tenant-b', roleId: 'role-viewer-b', permissionId: 'permission-ticket-read' },
  );
  memberships.push(
    {
      id: 'membership-owner-a',
      tenantId: 'tenant-a',
      userId: 'user-multi',
      roleId: 'role-owner-a',
      status: 'ACTIVE',
    },
    {
      id: 'membership-viewer-b',
      tenantId: 'tenant-b',
      userId: 'user-multi',
      roleId: 'role-viewer-b',
      status: 'ACTIVE',
    },
  );
}
