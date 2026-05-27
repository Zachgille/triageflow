import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@triageflow/db';

import { PrismaService } from '../database/prisma.service';
import type { RequestContext } from '../tenant-context/request-context';
import type {
  AuditEntityPagination,
  AuditPrismaClient,
  AuditRecordInput,
  AuditTenantFilters,
} from './audit.types';

const defaultLimit = 50;
const maxLimit = 100;

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(ctx: RequestContext, input: AuditRecordInput, client: AuditPrismaClient = this.prisma) {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      metadata: input.metadata ?? {},
      requestId: input.requestId ?? ctx.requestId,
      ...(input.before !== undefined ? { before: this.toNullableJson(input.before) } : {}),
      ...(input.after !== undefined ? { after: this.toNullableJson(input.after) } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
    };

    return client.auditLog.create({
      data,
    });
  }

  async listForEntity(
    ctx: RequestContext,
    entityType: string,
    entityId: string,
    pagination: AuditEntityPagination = {},
    client: AuditPrismaClient = this.prisma,
  ) {
    return client.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: this.normalizeLimit(pagination.limit),
      ...(pagination.cursor ? { cursor: { id: pagination.cursor }, skip: 1 } : {}),
    });
  }

  async listForTenant(
    ctx: RequestContext,
    filters: AuditTenantFilters = {},
    client: AuditPrismaClient = this.prisma,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId: ctx.tenantId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.actorUserId !== undefined ? { actorUserId: filters.actorUserId } : {}),
    };

    return client.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: this.normalizeLimit(filters.limit),
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
  }

  private normalizeLimit(limit: number | undefined) {
    if (!limit) {
      return defaultLimit;
    }

    return Math.min(Math.max(limit, 1), maxLimit);
  }

  private toNullableJson(value: Prisma.InputJsonValue | null) {
    return value === null ? Prisma.JsonNull : value;
  }
}
