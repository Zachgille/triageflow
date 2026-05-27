import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service';
import { tenantAContext, tenantBContext } from '../tickets/ticket.test-helpers';
import { AuditService } from './audit.service';

type MockAuditLogDelegate = {
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
};

function createMockClient(delegate: MockAuditLogDelegate = createMockDelegate()) {
  return {
    auditLog: delegate,
  };
}

function createMockDelegate(): MockAuditLogDelegate {
  return {
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'audit-log-id', ...data })),
    findMany: vi.fn().mockResolvedValue([]),
  };
}

describe('AuditService', () => {
  it('records tenant, actor, request, entity, and action fields', async () => {
    const client = createMockClient();
    const service = new AuditService(client as unknown as PrismaService);

    await service.record(tenantAContext, {
      entityType: 'ticket',
      entityId: 'ticket-a',
      action: 'ticket.created',
      after: { status: 'NEW' },
      metadata: { source: 'test' },
    });

    expect(client.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: tenantAContext.tenantId,
        actorUserId: tenantAContext.userId,
        entityType: 'ticket',
        entityId: 'ticket-a',
        action: 'ticket.created',
        after: { status: 'NEW' },
        metadata: { source: 'test' },
        requestId: tenantAContext.requestId,
      },
    });
  });

  it('lists entity logs scoped to ctx.tenantId', async () => {
    const client = createMockClient();
    const service = new AuditService(client as unknown as PrismaService);

    await service.listForEntity(tenantAContext, 'ticket', 'shared-ticket-id', { limit: 25 });

    expect(client.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantAContext.tenantId,
        entityType: 'ticket',
        entityId: 'shared-ticket-id',
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  });

  it('does not let another tenant see logs for the same entity id', async () => {
    const client = createMockClient();
    const service = new AuditService(client as unknown as PrismaService);

    await service.listForEntity(tenantBContext, 'ticket', 'shared-ticket-id');

    expect(client.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantBContext.tenantId,
        entityType: 'ticket',
        entityId: 'shared-ticket-id',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('lists tenant logs scoped by tenant and filters', async () => {
    const client = createMockClient();
    const service = new AuditService(client as unknown as PrismaService);

    await service.listForTenant(tenantAContext, {
      action: 'ticket.assigned',
      actorUserId: 'agent-a',
      entityType: 'ticket',
      limit: 250,
    });

    expect(client.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantAContext.tenantId,
        action: 'ticket.assigned',
        actorUserId: 'agent-a',
        entityType: 'ticket',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('can record through a provided transaction client', async () => {
    const defaultClient = createMockClient();
    const transactionClient = createMockClient();
    const service = new AuditService(defaultClient as unknown as PrismaService);

    await service.record(
      tenantAContext,
      {
        entityType: 'ticket',
        entityId: 'ticket-a',
        action: 'ticket.status_changed',
        before: { status: 'OPEN' },
        after: { status: 'RESOLVED' },
      },
      transactionClient,
    );

    expect(defaultClient.auditLog.create).not.toHaveBeenCalled();
    expect(transactionClient.auditLog.create).toHaveBeenCalledOnce();
  });
});
