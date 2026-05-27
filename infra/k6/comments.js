import http from 'k6/http';
import { check, sleep } from 'k6';

/* global __ENV */

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
    'http_req_duration{endpoint:comments_list}': ['p(95)<150'],
    'http_req_duration{endpoint:comments_cursor}': ['p(95)<150'],
  },
};

const params = {
  headers: {
    authorization: `Bearer ${authToken}`,
  },
};

export default function commentsBenchmark() {
  const ticket = pickTicket();

  if (!ticket) {
    sleep(1);
    return;
  }

  const firstPage = getJson(
    `${apiBaseUrl}/api/tenants/${tenantSlug}/tickets/${ticket.id}/comments?limit=50`,
    'comments_list',
  );

  if (firstPage?.nextCursor) {
    getJson(
      `${apiBaseUrl}/api/tenants/${tenantSlug}/tickets/${ticket.id}/comments?limit=50&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
      'comments_cursor',
    );
  }

  sleep(1);
}

function pickTicket() {
  const response = http.get(`${apiBaseUrl}/api/tenants/${tenantSlug}/tickets?limit=1`, {
    ...params,
    tags: { endpoint: 'ticket_pick' },
  });

  if (response.status !== 200) {
    check(response, { 'ticket pick 200': () => false });
    return null;
  }

  return response.json('items.0');
}

function getJson(url, endpoint) {
  const response = http.get(url, { ...params, tags: { endpoint } });
  check(response, {
    [`${endpoint} returned 200`]: (result) => result.status === 200,
    [`${endpoint} returned cursor envelope`]: (result) => {
      try {
        const body = result.json();
        return Array.isArray(body.items) && 'hasMore' in body && 'nextCursor' in body;
      } catch {
        return false;
      }
    },
  });

  if (response.status !== 200) {
    return null;
  }

  return response.json();
}
