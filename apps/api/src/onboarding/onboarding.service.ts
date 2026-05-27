import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@triageflow/db';

import type { AuthIdentity } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { adminPermissionKeys, onboardingPermissionDefinitions, ownerPermissionKeys } from './onboarding.rbac';
import type { CreateTenantBody } from './onboarding.validation';

type PrismaTransaction = Prisma.TransactionClient;
type PrismaClientLike = PrismaService | PrismaTransaction;

@Injectable()
export class OnboardingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrentUser(identity: AuthIdentity) {
    const user = await this.findApplicationUser(this.prisma, identity.providerUserId);

    if (!user) {
      return {
        status: 'onboarding_required',
        code: 'APPLICATION_USER_NOT_FOUND',
        providerUserId: identity.providerUserId,
        email: identity.email ?? null,
        displayName: identity.displayName ?? null,
      } as const;
    }

    return this.toCurrentUserResponse(user);
  }

  async completeProfile(identity: AuthIdentity) {
    const email = identity.email ?? createFallbackEmail(identity.providerUserId);
    const displayName = identity.displayName ?? identity.email ?? 'TriageFlow user';

    await this.ensureEmailAvailable(identity.providerUserId, email);

    const user = await this.prisma.user.upsert({
      where: { clerkAuthProviderId: identity.providerUserId },
      create: {
        clerkAuthProviderId: identity.providerUserId,
        email,
        displayName,
      },
      update: {
        email,
        displayName,
      },
    });

    const hydratedUser = await this.findApplicationUser(this.prisma, user.clerkAuthProviderId);

    if (!hydratedUser) {
      throw new ForbiddenException({
        status: 'error',
        code: 'APPLICATION_USER_NOT_FOUND',
        message: 'Authenticated user is not registered in this application.',
      });
    }

    return this.toCurrentUserResponse(hydratedUser);
  }

  async createTenant(identity: AuthIdentity, input: CreateTenantBody) {
    const user = await this.findApplicationUser(this.prisma, identity.providerUserId);

    if (!user) {
      throw new ForbiddenException({
        status: 'error',
        code: 'APPLICATION_USER_NOT_FOUND',
        message: 'Complete your profile before creating a workspace.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const existingTenant = await tx.tenant.findUnique({
        where: { slug: input.slug },
        select: { id: true },
      });

      if (existingTenant) {
        throw new ConflictException({
          status: 'error',
          code: 'TENANT_SLUG_TAKEN',
          message: 'A workspace with this slug already exists.',
        });
      }

      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
        },
      });

      const permissions = await this.ensurePermissions(tx);
      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          key: 'owner',
          name: 'Owner',
          description: 'Full workspace ownership and administration.',
        },
      });
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          key: 'admin',
          name: 'Admin',
          description: 'Workspace administration and support operations.',
        },
      });

      await this.assignRolePermissions(tx, tenant.id, ownerRole.id, ownerPermissionKeys, permissions);
      await this.assignRolePermissions(tx, tenant.id, adminRole.id, adminPermissionKeys, permissions);

      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: ownerRole.id,
          status: 'ACTIVE',
        },
      });
    });

    const updatedUser = await this.findApplicationUser(this.prisma, identity.providerUserId);

    if (!updatedUser) {
      throw new ForbiddenException({
        status: 'error',
        code: 'APPLICATION_USER_NOT_FOUND',
        message: 'Authenticated user is not registered in this application.',
      });
    }

    return this.toCurrentUserResponse(updatedUser);
  }

  private async ensureEmailAvailable(providerUserId: string, email: string) {
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email },
      select: { clerkAuthProviderId: true },
    });

    if (existingByEmail && existingByEmail.clerkAuthProviderId !== providerUserId) {
      throw new ConflictException({
        status: 'error',
        code: 'EMAIL_ALREADY_LINKED',
        message: 'This email is already linked to another application user.',
      });
    }
  }

  private async ensurePermissions(tx: PrismaTransaction) {
    const permissions = await Promise.all(
      onboardingPermissionDefinitions.map((permission) =>
        tx.permission.upsert({
          where: { key: permission.key },
          create: permission,
          update: { description: permission.description },
        }),
      ),
    );

    return new Map(permissions.map((permission) => [permission.key, permission.id]));
  }

  private async assignRolePermissions(
    tx: PrismaTransaction,
    tenantId: string,
    roleId: string,
    permissionKeys: readonly string[],
    permissionIdsByKey: Map<string, string>,
  ) {
    await tx.rolePermission.createMany({
      data: permissionKeys.map((permissionKey) => ({
        tenantId,
        roleId,
        permissionId: requirePermissionId(permissionIdsByKey, permissionKey),
      })),
      skipDuplicates: true,
    });
  }

  private findApplicationUser(client: PrismaClientLike, providerUserId: string) {
    return client.user.findUnique({
      where: { clerkAuthProviderId: providerUserId },
      select: {
        id: true,
        clerkAuthProviderId: true,
        email: true,
        displayName: true,
        memberships: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            status: true,
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
              },
            },
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: { key: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private toCurrentUserResponse(user: NonNullable<Awaited<ReturnType<OnboardingService['findApplicationUser']>>>) {
    return {
      status: 'ok',
      user: {
        id: user.id,
        providerUserId: user.clerkAuthProviderId,
        email: user.email,
        displayName: user.displayName,
      },
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        status: membership.status,
        tenant: membership.tenant,
        role: {
          id: membership.role.id,
          key: membership.role.key,
          name: membership.role.name,
        },
        permissions: membership.role.rolePermissions
          .map((rolePermission) => rolePermission.permission.key)
          .sort((left, right) => left.localeCompare(right)),
      })),
    } as const;
  }
}

function createFallbackEmail(providerUserId: string) {
  const safeProviderId = providerUserId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeProviderId}@clerk.local`;
}

function requirePermissionId(permissionIdsByKey: Map<string, string>, key: string) {
  const permissionId = permissionIdsByKey.get(key);

  if (!permissionId) {
    throw new Error(`Permission ${key} was not created.`);
  }

  return permissionId;
}
