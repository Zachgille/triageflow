'use client';

export type ApiErrorBody = {
  status?: string;
  code?: string;
  message?: string;
};

export class ApiClientError extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message || `Request failed with status ${statusCode}`);
  }
}

export type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'PENDING_CUSTOMER'
  | 'PENDING_INTERNAL'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type Ticket = {
  id: string;
  tenantId: string;
  requesterId: string;
  assigneeUserId: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  description: string;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommentVisibility = 'PUBLIC' | 'INTERNAL';

export type TicketComment = {
  id: string;
  tenantId: string;
  ticketId: string;
  authorUserId: string | null;
  authorRequesterId: string | null;
  visibility: CommentVisibility;
  body: string;
  createdAt: string;
};

export type CursorListResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type TicketListResponse = CursorListResponse<Ticket>;

export type CommentListResponse = CursorListResponse<TicketComment>;

export type AnalyticsOverview = {
  newTicketCount: number;
  openTicketCount: number;
  pendingTicketCount: number;
  resolvedTicketCount: number;
  closedTicketCount: number;
  totalSlaBreachCount: number;
  unresolvedSlaBreachCount: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
};

export type AnalyticsDailyRollup = {
  id: string;
  tenantId: string;
  date: string;
  openedCount: number;
  resolvedCount: number;
  closedCount: number;
  publicCommentCount: number;
  internalNoteCount: number;
  firstResponseSlaBreachCount: number;
  resolutionSlaBreachCount: number;
  avgFirstResponseSeconds: number | null;
  avgResolutionSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalyticsDailyRollupsResponse = {
  data: AnalyticsDailyRollup[];
};

export type MeMembership = {
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
};

export type MeResponse =
  | {
      status: 'onboarding_required';
      code: 'APPLICATION_USER_NOT_FOUND';
      providerUserId: string;
      email: string | null;
      displayName: string | null;
    }
  | {
      status: 'ok';
      user: {
        id: string;
        providerUserId: string;
        email: string;
        displayName: string;
      };
      memberships: MeMembership[];
    };

export type TicketListFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeUserId?: string | null;
  cursor?: string | null;
  limit?: number;
};

export type CreateTicketPayload = {
  requesterId: string;
  priority?: TicketPriority;
  subject: string;
  description: string;
};

export type CreateCommentPayload = {
  visibility: CommentVisibility;
  body: string;
};

export type CreateTenantPayload = {
  name: string;
  slug: string;
};

const defaultApiBaseUrl = '';

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    return '';
  }

  return process.env.NEXT_PUBLIC_API_BASE_URL || defaultApiBaseUrl;
}

export class TriageFlowApi {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly getAuthToken: () => Promise<string | null>,
  ) {}

  getMe() {
    return this.request<MeResponse>('/api/me');
  }

  completeProfile() {
    return this.request<MeResponse>('/api/onboarding/profile', {
      method: 'POST',
      body: {},
    });
  }

  createTenant(payload: CreateTenantPayload) {
    return this.request<MeResponse>('/api/onboarding/tenant', {
      method: 'POST',
      body: payload,
    });
  }

  listTickets(tenantSlug: string, filters: TicketListFilters = {}) {
    const query = new URLSearchParams();

    if (filters.status) {
      query.set('status', filters.status);
    }

    if (filters.priority) {
      query.set('priority', filters.priority);
    }

    if (filters.assigneeUserId !== undefined) {
      query.set('assigneeUserId', filters.assigneeUserId ?? '');
    }

    if (filters.cursor) {
      query.set('cursor', filters.cursor);
    }

    if (filters.limit) {
      query.set('limit', String(filters.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<TicketListResponse>(`/api/tenants/${tenantSlug}/tickets${suffix}`);
  }

  getTicket(tenantSlug: string, ticketId: string) {
    return this.request<Ticket>(`/api/tenants/${tenantSlug}/tickets/${ticketId}`);
  }

  createTicket(tenantSlug: string, payload: CreateTicketPayload) {
    return this.request<Ticket>(`/api/tenants/${tenantSlug}/tickets`, {
      method: 'POST',
      body: payload,
    });
  }

  updateTicket(tenantSlug: string, ticketId: string, payload: Partial<Pick<Ticket, 'priority' | 'subject' | 'description'>>) {
    return this.request<Ticket>(`/api/tenants/${tenantSlug}/tickets/${ticketId}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  transitionTicket(tenantSlug: string, ticketId: string, status: TicketStatus) {
    return this.request<Ticket>(`/api/tenants/${tenantSlug}/tickets/${ticketId}/transition`, {
      method: 'POST',
      body: { status },
    });
  }

  assignTicket(tenantSlug: string, ticketId: string, assigneeUserId: string | null) {
    return this.request<Ticket>(`/api/tenants/${tenantSlug}/tickets/${ticketId}/assign`, {
      method: 'POST',
      body: { assigneeUserId },
    });
  }

  listComments(tenantSlug: string, ticketId: string, filters: { cursor?: string | null; limit?: number } = {}) {
    const query = new URLSearchParams();

    if (filters.cursor) {
      query.set('cursor', filters.cursor);
    }

    if (filters.limit) {
      query.set('limit', String(filters.limit));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<CommentListResponse>(`/api/tenants/${tenantSlug}/tickets/${ticketId}/comments${suffix}`);
  }

  createComment(tenantSlug: string, ticketId: string, payload: CreateCommentPayload) {
    return this.request<TicketComment>(`/api/tenants/${tenantSlug}/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: payload,
    });
  }

  getAnalyticsOverview(tenantSlug: string) {
    return this.request<AnalyticsOverview>(`/api/tenants/${tenantSlug}/analytics/overview`);
  }

  getAnalyticsDailyRollups(tenantSlug: string, from: string, to: string) {
    const query = new URLSearchParams({ from, to });
    return this.request<AnalyticsDailyRollupsResponse>(
      `/api/tenants/${tenantSlug}/analytics/daily-rollups?${query.toString()}`,
    );
  }

  private async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const token = await this.getAuthToken();
    const headers: Record<string, string> = {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    };

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const requestInit: RequestInit = {
      method: init.method || 'GET',
      headers,
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    };
    const response = await fetch(`${this.apiBaseUrl}${path}`, requestInit);

    if (!response.ok) {
      throw new ApiClientError(response.status, await parseErrorBody(response));
    }

    return response.json() as Promise<T>;
  }
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {
      status: 'error',
      code: 'REQUEST_FAILED',
      message: response.statusText,
    };
  }
}
