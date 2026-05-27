import type { Prisma } from '@triageflow/db';

export const auditActions = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.assigned',
  'ticket.priority_changed',
  'comment.public_created',
  'comment.internal_created',
] as const;

export type AuditAction = (typeof auditActions)[number];

export type AuditEntityType = string;

export type AuditRecordInput = {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue;
  requestId?: string | null;
  ipAddress?: string | null;
};

export type AuditEntityPagination = {
  limit?: number;
  cursor?: string;
};

export type AuditTenantFilters = {
  entityType?: AuditEntityType;
  action?: AuditAction;
  actorUserId?: string | null;
  limit?: number;
  cursor?: string;
};

export type AuditPrismaClient = {
  auditLog: Pick<Prisma.TransactionClient['auditLog'], 'create' | 'findMany'>;
};
