import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service';
import { TicketTenantConstraintError, RequestContextRequiredError } from './ticket.errors';
import { TicketRepository } from './ticket.repository';
import { makeTicket, tenantAContext, tenantBContext } from './ticket.test-helpers';

type MockPrisma = {
  ticket: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  requester: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  membership: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function createMockPrisma(): MockPrisma {
  return {
    ticket: {
      findMany: vi.fn().mockResolvedValue([makeTicket({ tenantId: tenantAContext.tenantId })]),
      findFirst: vi.fn().mockImplementation(({ where }: { where: { id: string; tenantId: string } }) => {
        if (where.tenantId !== tenantAContext.tenantId) {
          return Promise.resolve(null);
        }

        return Promise.resolve(makeTicket({ id: where.id, tenantId: where.tenantId }));
      }),
      create: vi.fn().mockImplementation(({ data }: { data: { tenantId: string } }) =>
        Promise.resolve(makeTicket({ tenantId: data.tenantId })),
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Partial<ReturnType<typeof makeTicket>> }) =>
        Promise.resolve(makeTicket(data)),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    requester: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { tenantId_id: { tenantId: string } } }) => {
        if (where.tenantId_id.tenantId !== tenantAContext.tenantId) {
          return Promise.resolve(null);
        }

        return Promise.resolve({ id: 'requester-a' });
      }),
    },
    membership: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { tenantId_userId: { tenantId: string } } }) => {
        if (where.tenantId_userId.tenantId !== tenantAContext.tenantId) {
          return Promise.resolve(null);
        }

        return Promise.resolve({ id: 'membership-a' });
      }),
    },
  };
}

function createRepository(mockPrisma = createMockPrisma()) {
  return {
    repository: new TicketRepository(mockPrisma as unknown as PrismaService),
    mockPrisma,
  };
}

describe('TicketRepository tenant scoping', () => {
  it('requires RequestContext for repository operations', async () => {
    const { repository } = createRepository();

    await expect(repository.findMany(undefined as never)).rejects.toBeInstanceOf(RequestContextRequiredError);
  });

  it('listTickets scopes queries by ctx.tenantId', async () => {
    const { repository, mockPrisma } = createRepository();

    await repository.findMany(tenantAContext, { status: 'OPEN' });

    expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: tenantAContext.tenantId,
        status: 'OPEN',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 51,
    });
  });

  it('getTicket includes tenant scope and cannot read another tenant ticket', async () => {
    const { repository, mockPrisma } = createRepository();

    const ticket = await repository.findById(tenantBContext, 'ticket-a');

    expect(ticket).toBeNull();
    expect(mockPrisma.ticket.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'ticket-a',
        tenantId: tenantBContext.tenantId,
      },
    });
  });

  it('create rejects requesters from another tenant', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.requester.findUnique.mockResolvedValueOnce(null);
    const { repository } = createRepository(mockPrisma);

    await expect(
      repository.create(tenantAContext, {
        requesterId: 'requester-b',
        subject: 'Cross tenant requester',
        description: 'Should fail.',
      }),
    ).rejects.toBeInstanceOf(TicketTenantConstraintError);
  });

  it('assign rejects assignees from another tenant', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.membership.findUnique.mockResolvedValueOnce(null);
    const { repository } = createRepository(mockPrisma);

    await expect(repository.assign(tenantAContext, 'ticket-a', 'user-b')).rejects.toBeInstanceOf(
      TicketTenantConstraintError,
    );
  });

  it('sets first_responded_at through a tenant-scoped update only when unset', async () => {
    const { repository, mockPrisma } = createRepository();
    const firstRespondedAt = new Date('2026-05-26T13:00:00.000Z');

    await repository.markFirstRespondedAtIfUnset(tenantAContext, 'ticket-a', firstRespondedAt);

    expect(mockPrisma.ticket.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ticket-a',
        tenantId: tenantAContext.tenantId,
        firstRespondedAt: null,
      },
      data: { firstRespondedAt },
    });
  });

  it('sets resolved_at only the first time a ticket enters resolved', async () => {
    const existingResolvedAt = new Date('2026-05-26T13:00:00.000Z');
    const mockPrisma = createMockPrisma();
    mockPrisma.ticket.findFirst.mockResolvedValueOnce(
      makeTicket({ status: 'OPEN', resolvedAt: existingResolvedAt }),
    );
    const { repository } = createRepository(mockPrisma);

    await repository.transitionStatus(tenantAContext, 'ticket-a', 'RESOLVED');

    expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-a' },
      data: { status: 'RESOLVED' },
    });
  });

  it('sets closed_at only the first time a ticket enters closed', async () => {
    const existingClosedAt = new Date('2026-05-26T14:00:00.000Z');
    const mockPrisma = createMockPrisma();
    mockPrisma.ticket.findFirst.mockResolvedValueOnce(
      makeTicket({ status: 'RESOLVED', closedAt: existingClosedAt }),
    );
    const { repository } = createRepository(mockPrisma);

    await repository.transitionStatus(tenantAContext, 'ticket-a', 'CLOSED');

    expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-a' },
      data: { status: 'CLOSED' },
    });
  });

  it('does not expose unscoped query helper methods', () => {
    const { repository } = createRepository();

    expect('findManyUnscoped' in repository).toBe(false);
    expect('findByIdUnscoped' in repository).toBe(false);
  });
});
