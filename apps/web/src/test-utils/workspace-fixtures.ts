import { vi } from 'vitest';

export function okMe(memberships: ReturnType<typeof membership>[]) {
  return {
    status: 'ok' as const,
    user: {
      id: 'user-1',
      providerUserId: 'user_clerk',
      email: 'pat@example.com',
      displayName: 'Pat Support',
    },
    memberships,
  };
}

export function membership({
  id = 'membership-demo',
  permissions = ['ticket:read'],
  roleKey = 'viewer',
  roleName = 'Viewer',
  tenantName = 'Demo Support',
  tenantSlug = 'demo',
}: {
  id?: string;
  permissions?: string[];
  roleKey?: string;
  roleName?: string;
  tenantName?: string;
  tenantSlug?: string;
}) {
  return {
    id,
    status: 'ACTIVE',
    tenant: {
      id: `tenant-${tenantSlug}`,
      slug: tenantSlug,
      name: tenantName,
    },
    role: {
      id: `role-${roleKey}`,
      key: roleKey,
      name: roleName,
    },
    permissions,
  };
}

export function mockApi({
  analyticsError,
  analyticsOverview = null,
  analyticsRollups = [],
  comments = [],
  commentPages,
  me,
  ticket = null,
  ticketPages,
  tickets = [],
}: {
  analyticsError?: { status: number; body: unknown };
  analyticsOverview?: unknown;
  analyticsRollups?: unknown[];
  comments?: unknown[];
  commentPages?: Record<string, { items: unknown[]; nextCursor: string | null; hasMore: boolean }>;
  me: unknown;
  ticket?: unknown;
  ticketPages?: Record<string, { items: unknown[]; nextCursor: string | null; hasMore: boolean }>;
  tickets?: unknown[];
}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = getRequestUrl(input);

    if (url === '/api/me') {
      return Promise.resolve(jsonResponse(me));
    }

    if (url.includes('/analytics/overview')) {
      if (analyticsError) {
        return Promise.resolve(jsonResponse(analyticsError.body, analyticsError.status));
      }

      return Promise.resolve(jsonResponse(analyticsOverview));
    }

    if (url.includes('/analytics/daily-rollups')) {
      if (analyticsError) {
        return Promise.resolve(jsonResponse(analyticsError.body, analyticsError.status));
      }

      return Promise.resolve(jsonResponse({ data: analyticsRollups }));
    }

    if (url.includes('/comments')) {
      const cursor = getQueryParam(url, 'cursor') ?? 'first';
      const page = commentPages?.[cursor] ?? { items: comments, nextCursor: null, hasMore: false };
      return Promise.resolve(jsonResponse(page));
    }

    if (url.includes('/tickets/') && !url.includes('/transition') && !url.includes('/assign')) {
      return Promise.resolve(jsonResponse(ticket));
    }

    if (url.includes('/tickets')) {
      const cursor = getQueryParam(url, 'cursor') ?? 'first';
      const page = ticketPages?.[cursor] ?? { items: tickets, nextCursor: null, hasMore: false };
      return Promise.resolve(jsonResponse(page));
    }

    return Promise.resolve(jsonResponse({ status: 'error', message: `Unhandled ${url}` }, 404));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getQueryParam(url: string, key: string) {
  const parsed = new URL(url, 'http://localhost');
  return parsed.searchParams.get(key);
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}
