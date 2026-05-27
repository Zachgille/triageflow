import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { PrismaService } from '../database/prisma.service';
import { getAuthIdentity } from '../auth/request-auth';
import type { RequestContext } from './request-context';

@Injectable()
export class TenantResolver {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(request: FastifyRequest, tenantSlug: string): Promise<RequestContext> {
    const identity = getAuthIdentity(request);

    if (!identity) {
      throw new ForbiddenException({
        status: 'error',
        code: 'AUTH_CONTEXT_MISSING',
        message: 'Authentication context is missing.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkAuthProviderId: identity.providerUserId },
      select: { id: true },
    });

    if (!user) {
      throw new ForbiddenException({
        status: 'error',
        code: 'APPLICATION_USER_NOT_FOUND',
        message: 'Authenticated user is not registered in this application.',
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException({
        status: 'error',
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant was not found.',
      });
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      select: {
        id: true,
        role: {
          select: {
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
    });

    if (!membership) {
      throw new ForbiddenException({
        status: 'error',
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message: 'Tenant membership is required.',
      });
    }

    return {
      requestId: request.id,
      userId: user.id,
      tenantId: tenant.id,
      membershipId: membership.id,
      permissions: membership.role.rolePermissions.map((rolePermission) => rolePermission.permission.key),
    };
  }
}
