import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const requireFromDbPackage = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { PrismaClient } = requireFromDbPackage('@prisma/client');

const prisma = new PrismaClient();

const tenantCount = readInt('BENCH_TENANT_COUNT', 10);
const totalUsers = readInt('BENCH_USER_COUNT', 500);
const totalTickets = readInt('BENCH_TICKET_COUNT', 50_000);
const commentsPerTicket = readInt('BENCH_COMMENTS_PER_TICKET', 5);
const targetAuditLogs = readInt('BENCH_AUDIT_LOG_COUNT', 500_000);
const analyticsDays = readInt('BENCH_ANALYTICS_DAYS', 30);
const dryRun = process.argv.includes('--dry-run');
const chunkSize = readInt('BENCH_SEED_CHUNK_SIZE', 2_000);

const priorityConfig = {
  LOW: { firstResponseMinutes: 1440, resolutionMinutes: 10080 },
  NORMAL: { firstResponseMinutes: 480, resolutionMinutes: 4320 },
  HIGH: { firstResponseMinutes: 120, resolutionMinutes: 1440 },
  URGENT: { firstResponseMinutes: 30, resolutionMinutes: 480 },
};
const priorities = Object.keys(priorityConfig);
const statuses = ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED', 'CLOSED'];
const permissionKeys = [
  ['tenant.manage', 'Manage tenant settings and membership'],
  ['roles.manage', 'Manage roles and permissions'],
  ['ticket:read', 'Read ticket data'],
  ['ticket:create', 'Create ticket data'],
  ['ticket:update', 'Update ticket data and status'],
  ['ticket:assign', 'Assign ticket ownership'],
  ['comment:create_public', 'Create public ticket comments'],
  ['comment:create_internal', 'Create internal ticket notes'],
  ['comment:read_internal', 'Read internal ticket notes'],
  ['analytics:read', 'Read tenant analytics'],
];
const rolePermissions = {
  owner: permissionKeys.map(([key]) => key),
  admin: [
    'tenant.manage',
    'ticket:read',
    'ticket:create',
    'ticket:update',
    'ticket:assign',
    'comment:create_public',
    'comment:create_internal',
    'comment:read_internal',
    'analytics:read',
  ],
  agent: [
    'ticket:read',
    'ticket:update',
    'ticket:assign',
    'comment:create_public',
    'comment:create_internal',
    'comment:read_internal',
  ],
  viewer: ['ticket:read', 'comment:create_public'],
};

const benchmarkStart = new Date('2026-01-01T00:00:00.000Z');
const benchmarkUserProviderId = 'clerk_bench_owner';
const benchmarkLargeTenantSlug = 'bench-large';

if (dryRun) {
  printPlan();
  await prisma.$disconnect();
  process.exit(0);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}

async function main() {
  printPlan();
  console.log('Clearing existing benchmark tenants with slug prefix bench- ...');
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: 'bench-' } } });
  await prisma.user.deleteMany({ where: { clerkAuthProviderId: { startsWith: 'clerk_bench_' } } });

  const permissions = await ensurePermissions();
  const tenants = await createTenants();
  const rolesByTenant = await createRolesAndPermissions(tenants, permissions);
  const usersByTenant = await createUsersAndMemberships(tenants, rolesByTenant);
  const requestersByTenant = await createRequesters(tenants);
  const ticketRefs = await createTickets(tenants, usersByTenant, requestersByTenant);
  const commentCount = await createComments(ticketRefs, usersByTenant, requestersByTenant);
  const breachCount = await createSlaBreaches(ticketRefs);
  const auditCount = await createAuditLogs(ticketRefs, usersByTenant);
  const rollupCount = await createAnalyticsRollups(tenants);
  const counts = await countBenchmarkRows();
  const largeTenant = tenants[0];
  const largeTenantUsers = usersByTenant.get(largeTenant.id) ?? [];
  const benchAssigneeUserId = largeTenantUsers[1]?.id ?? largeTenantUsers[0]?.id;

  console.log('Benchmark seed complete.');
  console.log(
    JSON.stringify(
      {
        benchmarkAuth: {
          strategy: 'development bearer token',
          bearerToken: benchmarkUserProviderId,
          requiredApiEnv: {
            NODE_ENV: 'development',
            CLERK_DEV_BEARER_AUTH: 'true',
          },
        },
        benchmarkTenant: {
          id: largeTenant.id,
          slug: largeTenant.slug,
          assigneeUserId: benchAssigneeUserId,
        },
        inserted: {
          comments: commentCount,
          slaBreaches: breachCount,
          auditLogs: auditCount,
          analyticsDailyRollups: rollupCount,
        },
        counts,
      },
      null,
      2,
    ),
  );
}

async function ensurePermissions() {
  const permissions = new Map();

  for (const [key, description] of permissionKeys) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissions.set(key, permission);
  }

  return permissions;
}

async function createTenants() {
  const rows = Array.from({ length: tenantCount }, (_, index) => ({
    id: uuid(`tenant:${index}`),
    slug: index === 0 ? benchmarkLargeTenantSlug : `bench-tenant-${index + 1}`,
    name: index === 0 ? 'Benchmark Large Tenant' : `Benchmark Tenant ${index + 1}`,
    createdAt: addDays(benchmarkStart, index),
    updatedAt: addDays(benchmarkStart, index),
  }));

  await prisma.tenant.createMany({ data: rows });
  return rows;
}

async function createRolesAndPermissions(tenants, permissions) {
  const roleRows = [];
  const rolePermissionRows = [];
  const rolesByTenant = new Map();

  for (const tenant of tenants) {
    const tenantRoles = {};

    for (const roleKey of Object.keys(rolePermissions)) {
      const role = {
        id: uuid(`role:${tenant.id}:${roleKey}`),
        tenantId: tenant.id,
        key: roleKey,
        name: titleCase(roleKey),
        description: `Benchmark ${roleKey} role`,
      };
      roleRows.push(role);
      tenantRoles[roleKey] = role;

      for (const permissionKey of rolePermissions[roleKey]) {
        rolePermissionRows.push({
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: permissions.get(permissionKey).id,
        });
      }
    }

    rolesByTenant.set(tenant.id, tenantRoles);
  }

  await createMany('role', roleRows);
  await createMany('rolePermission', rolePermissionRows);
  return rolesByTenant;
}

async function createUsersAndMemberships(tenants, rolesByTenant) {
  const userRows = [];
  const membershipRows = [];
  const usersByTenant = new Map();
  const usersPerTenant = distribute(totalUsers, tenantCount);

  for (const [tenantIndex, tenant] of tenants.entries()) {
    const tenantUsers = [];

    for (let index = 0; index < usersPerTenant[tenantIndex]; index += 1) {
      const globalIndex = userRows.length;
      const roleKey = index === 0 ? 'owner' : index % 11 === 0 ? 'admin' : index % 3 === 0 ? 'viewer' : 'agent';
      const providerId = tenantIndex === 0 && index === 0 ? benchmarkUserProviderId : `clerk_bench_${tenantIndex}_${index}`;
      const user = {
        id: uuid(`user:${tenant.id}:${index}`),
        clerkAuthProviderId: providerId,
        email: `bench-user-${globalIndex}@triageflow.local`,
        displayName: `Benchmark User ${globalIndex}`,
        createdAt: addMinutes(benchmarkStart, globalIndex),
        updatedAt: addMinutes(benchmarkStart, globalIndex),
      };
      userRows.push(user);
      tenantUsers.push(user);
      membershipRows.push({
        id: uuid(`membership:${tenant.id}:${user.id}`),
        tenantId: tenant.id,
        userId: user.id,
        roleId: rolesByTenant.get(tenant.id)[roleKey].id,
        status: 'ACTIVE',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    }

    usersByTenant.set(tenant.id, tenantUsers);
  }

  await createMany('user', userRows);
  await createMany('membership', membershipRows);
  return usersByTenant;
}

async function createRequesters(tenants) {
  const requestersByTenant = new Map();
  const rows = [];
  const requestersPerTenant = 100;

  for (const tenant of tenants) {
    const tenantRequesters = [];

    for (let index = 0; index < requestersPerTenant; index += 1) {
      const requester = {
        id: uuid(`requester:${tenant.id}:${index}`),
        tenantId: tenant.id,
        email: `requester-${tenant.slug}-${index}@example.com`,
        name: `Requester ${tenant.slug} ${index}`,
        createdAt: addMinutes(benchmarkStart, index),
        updatedAt: addMinutes(benchmarkStart, index),
      };
      rows.push(requester);
      tenantRequesters.push(requester);
    }

    requestersByTenant.set(tenant.id, tenantRequesters);
  }

  await createMany('requester', rows);
  return requestersByTenant;
}

async function createTickets(tenants, usersByTenant, requestersByTenant) {
  const ticketRefs = [];
  const ticketDistribution = [Math.floor(totalTickets / 2), ...distribute(totalTickets - Math.floor(totalTickets / 2), tenantCount - 1)];
  const rows = [];

  for (const [tenantIndex, tenant] of tenants.entries()) {
    const tenantUsers = usersByTenant.get(tenant.id);
    const tenantRequesters = requestersByTenant.get(tenant.id);
    const ticketCount = ticketDistribution[tenantIndex] ?? 0;

    for (let index = 0; index < ticketCount; index += 1) {
      const priority = priorities[(index + tenantIndex) % priorities.length];
      const status = statuses[(index * 7 + tenantIndex) % statuses.length];
      const createdAt = addMinutes(benchmarkStart, index * 3 + tenantIndex * 17);
      const firstRespondedAt = ['OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED', 'CLOSED'].includes(status)
        ? addMinutes(createdAt, 30 + (index % 180))
        : null;
      const resolvedAt = ['RESOLVED', 'CLOSED'].includes(status) ? addMinutes(createdAt, 240 + (index % 2880)) : null;
      const closedAt = status === 'CLOSED' ? addMinutes(resolvedAt, 60 + (index % 720)) : null;
      const assignee = index % 5 === 0 ? null : tenantUsers[(index % Math.max(tenantUsers.length - 1, 1)) + 1] ?? tenantUsers[0];
      const requester = tenantRequesters[index % tenantRequesters.length];
      const policy = priorityConfig[priority];
      const ticket = {
        id: uuid(`ticket:${tenant.id}:${index}`),
        tenantId: tenant.id,
        requesterId: requester.id,
        assigneeUserId: assignee?.id ?? null,
        status,
        priority,
        subject: `${priority} ${status} benchmark ticket ${tenant.slug}-${index}`,
        description: `Deterministic benchmark ticket ${index} for ${tenant.slug}.`,
        firstResponseDueAt: addMinutes(createdAt, policy.firstResponseMinutes),
        resolutionDueAt: addMinutes(createdAt, policy.resolutionMinutes),
        firstRespondedAt,
        resolvedAt,
        closedAt,
        createdAt,
        updatedAt: closedAt ?? resolvedAt ?? firstRespondedAt ?? addMinutes(createdAt, 15),
      };
      rows.push(ticket);
      ticketRefs.push({
        id: ticket.id,
        tenantId: tenant.id,
        requesterId: requester.id,
        assigneeUserId: assignee?.id ?? null,
        priority,
        status,
        createdAt,
      });
    }
  }

  await createMany('slaPolicy', createSlaPolicyRows(tenants));
  await createMany('ticket', rows);
  return ticketRefs;
}

function createSlaPolicyRows(tenants) {
  return tenants.flatMap((tenant) =>
    priorities.map((priority) => ({
      id: uuid(`sla-policy:${tenant.id}:${priority}`),
      tenantId: tenant.id,
      name: `${titleCase(priority)} benchmark policy`,
      priority,
      firstResponseMinutes: priorityConfig[priority].firstResponseMinutes,
      resolutionMinutes: priorityConfig[priority].resolutionMinutes,
      isDefault: true,
      createdAt: benchmarkStart,
      updatedAt: benchmarkStart,
    })),
  );
}

async function createComments(ticketRefs, usersByTenant, requestersByTenant) {
  let inserted = 0;
  let buffer = [];

  for (const [ticketIndex, ticket] of ticketRefs.entries()) {
    const tenantUsers = usersByTenant.get(ticket.tenantId);
    const tenantRequesters = requestersByTenant.get(ticket.tenantId);

    for (let index = 0; index < commentsPerTicket; index += 1) {
      const internal = index === 2 || index === 4;
      const userAuthored = internal || index % 2 === 1;
      const createdAt = addMinutes(ticket.createdAt, 10 + index * 30);
      buffer.push({
        id: uuid(`comment:${ticket.id}:${index}`),
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        authorUserId: userAuthored ? tenantUsers[(ticketIndex + index) % tenantUsers.length].id : null,
        authorRequesterId: userAuthored ? null : tenantRequesters[ticketIndex % tenantRequesters.length].id,
        visibility: internal ? 'INTERNAL' : 'PUBLIC',
        body: `${internal ? 'Internal note' : 'Public reply'} ${index} for benchmark ticket ${ticket.id}.`,
        createdAt,
      });

      if (buffer.length >= chunkSize) {
        inserted += await createMany('ticketComment', buffer);
        buffer = [];
      }
    }
  }

  if (buffer.length) {
    inserted += await createMany('ticketComment', buffer);
  }

  return inserted;
}

async function createSlaBreaches(ticketRefs) {
  const rows = [];

  for (const [index, ticket] of ticketRefs.entries()) {
    if (index % 17 === 0) {
      rows.push({
        id: uuid(`sla-breach:first:${ticket.id}`),
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        breachType: 'FIRST_RESPONSE',
        breachedAt: addMinutes(ticket.createdAt, priorityConfig[ticket.priority].firstResponseMinutes + 1),
        acknowledgedAt: index % 6 === 0 ? addMinutes(ticket.createdAt, priorityConfig[ticket.priority].firstResponseMinutes + 60) : null,
        metadata: { benchmark: true },
        createdAt: addMinutes(ticket.createdAt, priorityConfig[ticket.priority].firstResponseMinutes + 1),
      });
    }

    if (index % 23 === 0) {
      rows.push({
        id: uuid(`sla-breach:resolution:${ticket.id}`),
        tenantId: ticket.tenantId,
        ticketId: ticket.id,
        breachType: 'RESOLUTION',
        breachedAt: addMinutes(ticket.createdAt, priorityConfig[ticket.priority].resolutionMinutes + 1),
        acknowledgedAt: index % 8 === 0 ? addMinutes(ticket.createdAt, priorityConfig[ticket.priority].resolutionMinutes + 120) : null,
        metadata: { benchmark: true },
        createdAt: addMinutes(ticket.createdAt, priorityConfig[ticket.priority].resolutionMinutes + 1),
      });
    }
  }

  return createMany('slaBreach', rows);
}

async function createAuditLogs(ticketRefs, usersByTenant) {
  const logsPerTicket = Math.max(1, Math.floor(targetAuditLogs / Math.max(ticketRefs.length, 1)));
  let inserted = 0;
  let buffer = [];

  for (const [ticketIndex, ticket] of ticketRefs.entries()) {
    const tenantUsers = usersByTenant.get(ticket.tenantId);

    for (let index = 0; index < logsPerTicket; index += 1) {
      if (inserted + buffer.length >= targetAuditLogs) {
        break;
      }

      const action = ['ticket.created', 'ticket.updated', 'ticket.status_changed', 'ticket.assigned'][index % 4];
      buffer.push({
        id: uuid(`audit:${ticket.id}:${index}`),
        tenantId: ticket.tenantId,
        actorUserId: tenantUsers[(ticketIndex + index) % tenantUsers.length].id,
        entityType: 'ticket',
        entityId: ticket.id,
        action,
        before: index === 0 ? null : { status: 'OPEN' },
        after: { status: ticket.status, priority: ticket.priority, benchmark: true },
        metadata: { benchmark: true, sequence: index },
        requestId: `bench-${ticketIndex}-${index}`,
        ipAddress: '127.0.0.1',
        createdAt: addMinutes(ticket.createdAt, index),
      });

      if (buffer.length >= chunkSize) {
        inserted += await createMany('auditLog', buffer);
        buffer = [];
      }
    }
  }

  if (buffer.length) {
    inserted += await createMany('auditLog', buffer);
  }

  return inserted;
}

async function createAnalyticsRollups(tenants) {
  const rows = [];

  for (const tenant of tenants) {
    for (let day = 0; day < analyticsDays; day += 1) {
      const date = utcDateOnly(addDays(benchmarkStart, day));
      rows.push({
        id: uuid(`rollup:${tenant.id}:${day}`),
        tenantId: tenant.id,
        date,
        openedCount: tenant.slug === benchmarkLargeTenantSlug ? 800 + (day % 50) : 80 + day,
        resolvedCount: tenant.slug === benchmarkLargeTenantSlug ? 280 + (day % 40) : 20 + (day % 10),
        closedCount: tenant.slug === benchmarkLargeTenantSlug ? 190 + (day % 35) : 15 + (day % 8),
        publicCommentCount: tenant.slug === benchmarkLargeTenantSlug ? 2500 + day : 250 + day,
        internalNoteCount: tenant.slug === benchmarkLargeTenantSlug ? 1500 + day : 150 + day,
        firstResponseSlaBreachCount: day % 5,
        resolutionSlaBreachCount: day % 7,
        avgFirstResponseSeconds: 900 + day * 3,
        avgResolutionSeconds: 18_000 + day * 60,
        createdAt: date,
        updatedAt: date,
      });
    }
  }

  return createMany('analyticsDailyRollup', rows);
}

async function countBenchmarkRows() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: 'bench-' } },
    select: { id: true, slug: true },
  });
  const tenantIds = tenants.map((tenant) => tenant.id);

  return {
    tenants: tenants.length,
    users: await prisma.user.count({ where: { clerkAuthProviderId: { startsWith: 'clerk_bench_' } } }),
    memberships: await prisma.membership.count({ where: { tenantId: { in: tenantIds } } }),
    requesters: await prisma.requester.count({ where: { tenantId: { in: tenantIds } } }),
    tickets: await prisma.ticket.count({ where: { tenantId: { in: tenantIds } } }),
    comments: await prisma.ticketComment.count({ where: { tenantId: { in: tenantIds } } }),
    auditLogs: await prisma.auditLog.count({ where: { tenantId: { in: tenantIds } } }),
    slaBreaches: await prisma.slaBreach.count({ where: { tenantId: { in: tenantIds } } }),
    analyticsDailyRollups: await prisma.analyticsDailyRollup.count({ where: { tenantId: { in: tenantIds } } }),
  };
}

async function createMany(model, rows) {
  if (!rows.length) {
    return 0;
  }

  let inserted = 0;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const batch = rows.slice(index, index + chunkSize);
    const result = await prisma[model].createMany({ data: batch });
    inserted += result.count;
    if (inserted % 50_000 === 0) {
      console.log(`Inserted ${inserted} ${model} rows...`);
    }
  }

  return inserted;
}

function distribute(total, buckets) {
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

function uuid(input) {
  const bytes = createHash('sha1').update(`triageflow-benchmark:${input}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function readInt(name, defaultValue) {
  const raw = process.env[name];

  if (!raw) {
    return defaultValue;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function addMinutes(date, minutes) {
  if (!date) {
    return null;
  }

  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function utcDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function printPlan() {
  console.log(
    JSON.stringify(
      {
        dryRun,
        targetDataset: {
          tenants: tenantCount,
          users: totalUsers,
          tickets: totalTickets,
          comments: totalTickets * commentsPerTicket,
          auditLogs: targetAuditLogs,
          largeTenantTickets: Math.floor(totalTickets / 2),
          analyticsDays,
        },
        clearsOnly: 'tenants where slug starts with bench-',
        benchmarkAuthProviderId: benchmarkUserProviderId,
        benchmarkTenantSlug: benchmarkLargeTenantSlug,
      },
      null,
      2,
    ),
  );
}
