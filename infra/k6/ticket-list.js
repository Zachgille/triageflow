import http from 'k6/http';
import { check, sleep } from 'k6';

/* global __ENV */

const apiBaseUrl = __ENV.API_BASE_URL || 'http://localhost:3001';
const tenantSlug = __ENV.TENANT_SLUG || 'bench-large';
const authToken = __ENV.BENCH_AUTH_TOKEN || 'clerk_bench_owner';
const assigneeUserId = __ENV.BENCH_ASSIGNEE_USER_ID || '';
const duration = __ENV.DURATION || '5m';
const vus = Number(__ENV.VUS || '20');

export const options = {
  vus,
  duration,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{endpoint:ticket_list}': ['p(95)<150'],
    'http_req_duration{endpoint:ticket_list_status}': ['p(95)<150'],
    'http_req_duration{endpoint:ticket_list_priority}': ['p(95)<150'],
    'http_req_duration{endpoint:ticket_list_assignee}': ['p(95)<150'],
    'http_req_duration{endpoint:ticket_list_cursor}': ['p(95)<150'],
  },
};

const params = {
  headers: {
    authorization: `Bearer ${authToken}`,
  },
};

export default function ticketListBenchmark() {
  const base = `${apiBaseUrl}/api/tenants/${tenantSlug}/tickets`;
  const firstPage = getJson(`${base}?limit=50`, 'ticket_list');

  getJson(`${base}?status=OPEN&limit=50`, 'ticket_list_status');
  getJson(`${base}?priority=HIGH&limit=50`, 'ticket_list_priority');

  if (assigneeUserId) {
    getJson(`${base}?assigneeUserId=${encodeURIComponent(assigneeUserId)}&limit=50`, 'ticket_list_assignee');
  }

  if (firstPage?.nextCursor) {
    getJson(`${base}?limit=50&cursor=${encodeURIComponent(firstPage.nextCursor)}`, 'ticket_list_cursor');
  }

  sleep(1);
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
