import http from 'k6/http';
import { check, sleep } from 'k6';

/* global __ENV, __ITER, __VU */

const apiBaseUrl = __ENV.API_BASE_URL || 'http://localhost:3001';
const tenantSlug = __ENV.TENANT_SLUG || 'bench-large';
const authToken = __ENV.BENCH_AUTH_TOKEN || 'clerk_bench_owner';
const duration = __ENV.DURATION || '5m';
const vus = Number(__ENV.VUS || '20');

export const options = {
  vus,
  duration,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{kind:read}': ['p(95)<150'],
  },
};

const params = {
  headers: {
    authorization: `Bearer ${authToken}`,
  },
};

export default function mixedWorkload() {
  const selector = (__ITER * 37 + __VU) % 100;

  if (selector < 60) {
    ticketList();
  } else if (selector < 80) {
    ticketDetail();
  } else if (selector < 90) {
    commentsList();
  } else if (selector < 95) {
    analyticsOverview();
  } else {
    analyticsDailyRollups();
  }

  sleep(1);
}

function ticketList() {
  const response = http.get(`${apiBaseUrl}/api/tenants/${tenantSlug}/tickets?limit=50`, {
    ...params,
    tags: { endpoint: 'ticket_list', kind: 'read' },
  });
  check(response, {
    'ticket list 200': (result) => result.status === 200,
    'ticket list has items': (result) => Array.isArray(result.json('items')),
  });
}

function ticketDetail() {
  const ticket = pickTicket();

  if (!ticket) {
    return;
  }

  const response = http.get(`${apiBaseUrl}/api/tenants/${tenantSlug}/tickets/${ticket.id}`, {
    ...params,
    tags: { endpoint: 'ticket_detail', kind: 'read' },
  });
  check(response, {
    'ticket detail 200': (result) => result.status === 200,
  });
}

function commentsList() {
  const ticket = pickTicket();

  if (!ticket) {
    return;
  }

  const response = http.get(`${apiBaseUrl}/api/tenants/${tenantSlug}/tickets/${ticket.id}/comments?limit=50`, {
    ...params,
    tags: { endpoint: 'comments_list', kind: 'read' },
  });
  check(response, {
    'comments list 200': (result) => result.status === 200,
    'comments list has items': (result) => Array.isArray(result.json('items')),
  });
}

function analyticsOverview() {
  const response = http.get(`${apiBaseUrl}/api/tenants/${tenantSlug}/analytics/overview`, {
    ...params,
    tags: { endpoint: 'analytics_overview', kind: 'read' },
  });
  check(response, {
    'analytics overview 200': (result) => result.status === 200,
  });
}

function analyticsDailyRollups() {
  const response = http.get(
    `${apiBaseUrl}/api/tenants/${tenantSlug}/analytics/daily-rollups?from=2026-01-01&to=2026-01-14`,
    {
      ...params,
      tags: { endpoint: 'analytics_daily_rollups', kind: 'read' },
    },
  );
  check(response, {
    'analytics daily rollups 200': (result) => result.status === 200,
  });
}

function pickTicket() {
  const response = http.get(`${apiBaseUrl}/api/tenants/${tenantSlug}/tickets?limit=1`, {
    ...params,
    tags: { endpoint: 'ticket_pick', kind: 'read' },
  });

  if (response.status !== 200) {
    check(response, { 'ticket pick 200': () => false });
    return null;
  }

  const body = response.json();
  const ticket = body.items?.[0];

  if (!ticket) {
    check(response, { 'ticket pick returned a ticket': () => false });
    return null;
  }

  return ticket;
}
