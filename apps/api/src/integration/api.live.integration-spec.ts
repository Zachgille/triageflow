import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@triageflow/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { authHeaders, createLiveApiApp, ids, resetAndSeed } from './live-api-test-harness';

type JsonResponse = {
  statusCode: number;
  payload: string;
  json: <T = unknown>() => T;
};

type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

type TicketResponse = {
  id: string;
  tenantId: string;
  status: string;
  priority: string;
  firstRespondedAt: string | null;
};

type CommentResponse = {
  id: string;
  visibility: 'PUBLIC' | 'INTERNAL';
  body: string;
};

const ownerAuth = authHeaders('clerk_owner_a');
const viewerAuth = authHeaders('clerk_viewer_a');
const agentAuth = authHeaders('clerk_agent_a');
const noMembershipAuth = authHeaders('clerk_no_membership');
const scopedBAuth = authHeaders('clerk_scoped_b');

describe('live PostgreSQL API integration', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    app = await createLiveApiApp();
  });

  beforeEach(async () => {
    await resetAndSeed(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  describe('tenant isolation', () => {
    it('prevents a Tenant A user from listing Tenant B tickets', async () => {
      const response = await get('/api/tenants/tenant-b/tickets', ownerAuth);

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('TENANT_MEMBERSHIP_REQUIRED');
    });

    it('does not read or comment on another tenant ticket through Tenant A context', async () => {
      const readResponse = await get(`/api/tenants/tenant-a/tickets/${ids.ticketB1}`, ownerAuth);
      expect(readResponse.statusCode).toBe(404);

      const listCommentsResponse = await get(
        `/api/tenants/tenant-a/tickets/${ids.ticketB1}/comments`,
        ownerAuth,
      );
      expect(listCommentsResponse.statusCode).toBe(404);

      const createCommentResponse = await post(
        `/api/tenants/tenant-a/tickets/${ids.ticketB1}/comments`,
        ownerAuth,
        { visibility: 'PUBLIC', body: 'cross tenant comment' },
      );
      expect(createCommentResponse.statusCode).toBe(404);
    });

    it('does not let Tenant A privileges grant Tenant B mutations', async () => {
      const response = await patch(`/api/tenants/tenant-b/tickets/${ids.ticketB1}`, scopedBAuth, {
        subject: 'not allowed',
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<{ code: string }>().code).toBe('PERMISSION_REQUIRED');
    });

    it('rejects cross-tenant requester and assignee references', async () => {
      const requesterResponse = await post('/api/tenants/tenant-a/tickets', ownerAuth, {
        requesterId: ids.requesterB,
        priority: 'NORMAL',
        subject: 'bad requester',
        description: 'bad requester description',
      });
      expect(requesterResponse.statusCode).toBe(400);
      expect(requesterResponse.json<{ code: string }>().code).toBe('TICKET_TENANT_CONSTRAINT');

      const assigneeResponse = await post('/api/tenants/tenant-a/tickets', ownerAuth, {
        requesterId: ids.requesterA,
        assigneeUserId: ids.scopedB,
        priority: 'NORMAL',
        subject: 'bad assignee',
        description: 'bad assignee description',
      });
      expect(assigneeResponse.statusCode).toBe(400);
      expect(assigneeResponse.json<{ code: string }>().code).toBe('TICKET_TENANT_CONSTRAINT');
    });
  });

  describe('RBAC', () => {
    it('rejects unauthenticated requests and valid users without membership', async () => {
      const unauthenticated = await get('/api/tenants/tenant-a/tickets');
      expect(unauthenticated.statusCode).toBe(401);

      const noMembership = await get('/api/tenants/tenant-a/tickets', noMembershipAuth);
      expect(noMembership.statusCode).toBe(403);
      expect(noMembership.json<{ code: string }>().code).toBe('TENANT_MEMBERSHIP_REQUIRED');
    });

    it('allows viewers to read tickets but not mutate them', async () => {
      const listResponse = await get('/api/tenants/tenant-a/tickets', viewerAuth);
      expect(listResponse.statusCode).toBe(200);

      const updateResponse = await patch(`/api/tenants/tenant-a/tickets/${ids.ticketA1}`, viewerAuth, {
        subject: 'viewer cannot mutate',
      });
      expect(updateResponse.statusCode).toBe(403);
    });

    it('allows permitted agents to update tickets', async () => {
      const response = await patch(`/api/tenants/tenant-a/tickets/${ids.ticketA1}`, agentAuth, {
        subject: 'agent update',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<{ subject: string }>().subject).toBe('agent update');
    });

    it('enforces analytics:read per tenant', async () => {
      const forbidden = await get('/api/tenants/tenant-b/analytics/overview', scopedBAuth);
      expect(forbidden.statusCode).toBe(403);

      const allowed = await get('/api/tenants/tenant-a/analytics/overview', ownerAuth);
      expect(allowed.statusCode).toBe(200);
      expect(allowed.json<{ openTicketCount: number }>().openTicketCount).toBe(2);
    });
  });

  describe('cursor pagination', () => {
    it('paginates tickets deterministically without duplicates', async () => {
      const first = await get('/api/tenants/tenant-a/tickets?limit=2', ownerAuth);
      expect(first.statusCode).toBe(200);
      const firstPage = first.json<Page<TicketResponse>>();
      expect(firstPage.items.map((ticket) => ticket.id)).toEqual([ids.ticketA3, ids.ticketA2]);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextCursor).toEqual(expect.any(String));

      const second = await get(
        `/api/tenants/tenant-a/tickets?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
        ownerAuth,
      );
      expect(second.statusCode).toBe(200);
      const secondPage = second.json<Page<TicketResponse>>();
      expect(secondPage.items.map((ticket) => ticket.id)).toEqual([ids.ticketA1]);
      expect(secondPage.hasMore).toBe(false);

      const seenIds = new Set([...firstPage.items, ...secondPage.items].map((ticket) => ticket.id));
      expect(seenIds.size).toBe(3);
    });

    it('preserves ticket filters across cursor pages and rejects invalid cursors', async () => {
      const statusPage = await get('/api/tenants/tenant-a/tickets?status=OPEN&limit=1', ownerAuth);
      expect(statusPage.statusCode).toBe(200);
      const statusPayload = statusPage.json<Page<TicketResponse>>();
      expect(statusPayload.items).toHaveLength(1);
      expect(statusPayload.items[0]!.status).toBe('OPEN');

      const nextStatusPage = await get(
        `/api/tenants/tenant-a/tickets?status=OPEN&limit=1&cursor=${encodeURIComponent(statusPayload.nextCursor!)}`,
        ownerAuth,
      );
      expect(nextStatusPage.statusCode).toBe(200);
      expect(nextStatusPage.json<Page<TicketResponse>>().items[0]!.status).toBe('OPEN');

      const priorityPage = await get('/api/tenants/tenant-a/tickets?priority=HIGH&limit=2', ownerAuth);
      expect(priorityPage.statusCode).toBe(200);
      expect(priorityPage.json<Page<TicketResponse>>().items.map((ticket) => ticket.priority)).toEqual(['HIGH']);

      const assigneePage = await get(
        `/api/tenants/tenant-a/tickets?assigneeUserId=${ids.agentA}&limit=2`,
        ownerAuth,
      );
      expect(assigneePage.statusCode).toBe(200);
      expect(assigneePage.json<Page<TicketResponse>>().items).toHaveLength(2);

      const invalidCursor = await get('/api/tenants/tenant-a/tickets?cursor=not-a-cursor', ownerAuth);
      expect(invalidCursor.statusCode).toBe(400);
    });

    it('paginates visible comments and preserves internal note filtering', async () => {
      const viewerFirst = await get(
        `/api/tenants/tenant-a/tickets/${ids.ticketA1}/comments?limit=1`,
        viewerAuth,
      );
      expect(viewerFirst.statusCode).toBe(200);
      const viewerFirstPage = viewerFirst.json<Page<CommentResponse>>();
      expect(viewerFirstPage.items.map((comment) => comment.id)).toEqual([
        '00000000-0000-4000-8000-000000000301',
      ]);
      expect(viewerFirstPage.items[0]!.visibility).toBe('PUBLIC');

      const viewerSecond = await get(
        `/api/tenants/tenant-a/tickets/${ids.ticketA1}/comments?limit=1&cursor=${encodeURIComponent(
          viewerFirstPage.nextCursor!,
        )}`,
        viewerAuth,
      );
      expect(viewerSecond.statusCode).toBe(200);
      expect(viewerSecond.json<Page<CommentResponse>>().items.map((comment) => comment.id)).toEqual([
        '00000000-0000-4000-8000-000000000303',
      ]);

      const internalReader = await get(
        `/api/tenants/tenant-a/tickets/${ids.ticketA1}/comments?limit=3`,
        ownerAuth,
      );
      expect(internalReader.statusCode).toBe(200);
      expect(internalReader.json<Page<CommentResponse>>().items.map((comment) => comment.visibility)).toEqual([
        'PUBLIC',
        'INTERNAL',
        'PUBLIC',
      ]);

      const invalidCursor = await get(
        `/api/tenants/tenant-a/tickets/${ids.ticketA1}/comments?cursor=not-a-cursor`,
        ownerAuth,
      );
      expect(invalidCursor.statusCode).toBe(400);
    });
  });

  describe('audit and transactional behavior', () => {
    it('writes ticket create audit logs transactionally', async () => {
      const response = await post('/api/tenants/tenant-a/tickets', ownerAuth, {
        requesterId: ids.requesterA,
        priority: 'NORMAL',
        subject: 'audited create',
        description: 'audited create description',
      });
      expect(response.statusCode).toBe(201);

      const created = response.json<TicketResponse>();
      const auditLog = await prisma.auditLog.findFirst({
        where: { tenantId: ids.tenantA, entityId: created.id, action: 'ticket.created' },
      });
      expect(auditLog).not.toBeNull();
    });

    it('does not create ticket or audit rows when SLA policy lookup fails', async () => {
      await prisma.slaPolicy.delete({ where: { tenantId_priority: { tenantId: ids.tenantA, priority: 'NORMAL' } } });
      const ticketCountBefore = await prisma.ticket.count({ where: { tenantId: ids.tenantA } });
      const auditCountBefore = await prisma.auditLog.count({ where: { tenantId: ids.tenantA } });

      const response = await post('/api/tenants/tenant-a/tickets', ownerAuth, {
        requesterId: ids.requesterA,
        priority: 'NORMAL',
        subject: 'missing sla',
        description: 'missing sla description',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ code: string }>().code).toBe('SLA_POLICY_NOT_FOUND');
      await expect(prisma.ticket.count({ where: { tenantId: ids.tenantA } })).resolves.toBe(ticketCountBefore);
      await expect(prisma.auditLog.count({ where: { tenantId: ids.tenantA } })).resolves.toBe(auditCountBefore);
    });

    it('writes comment audit logs and sets first_responded_at for the first public internal-user comment', async () => {
      const response = await post(`/api/tenants/tenant-a/tickets/${ids.ticketA2}/comments`, ownerAuth, {
        visibility: 'PUBLIC',
        body: 'first agent response',
      });
      expect(response.statusCode).toBe(201);

      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ids.ticketA2 } });
      expect(ticket.firstRespondedAt).not.toBeNull();

      const comment = response.json<CommentResponse>();
      const auditLog = await prisma.auditLog.findFirst({
        where: { tenantId: ids.tenantA, entityId: comment.id, action: 'comment.public_created' },
      });
      expect(auditLog).not.toBeNull();
    });

    it('does not satisfy first response when an internal note is created', async () => {
      const response = await post(`/api/tenants/tenant-a/tickets/${ids.ticketA2}/comments`, ownerAuth, {
        visibility: 'INTERNAL',
        body: 'internal note',
      });
      expect(response.statusCode).toBe(201);

      const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ids.ticketA2 } });
      expect(ticket.firstRespondedAt).toBeNull();
    });
  });

  async function get(url: string, headers: Record<string, string> = {}): Promise<JsonResponse> {
    return app.inject({ method: 'GET', url, headers });
  }

  async function post(url: string, headers: Record<string, string>, payload: unknown): Promise<JsonResponse> {
    return app.inject({
      method: 'POST',
      url,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
  }

  async function patch(url: string, headers: Record<string, string>, payload: unknown): Promise<JsonResponse> {
    return app.inject({
      method: 'PATCH',
      url,
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify(payload),
    });
  }
});
