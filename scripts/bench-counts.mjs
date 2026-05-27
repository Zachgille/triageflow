import { createRequire } from 'node:module';

const requireFromDbPackage = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { PrismaClient } = requireFromDbPackage('@prisma/client');
const prisma = new PrismaClient();

try {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: 'bench-' } },
    select: { id: true, slug: true },
    orderBy: { slug: 'asc' },
  });
  const tenantIds = tenants.map((tenant) => tenant.id);
  const largeTenant = tenants.find((tenant) => tenant.slug === 'bench-large');
  const benchOwner = await prisma.user.findUnique({
    where: { clerkAuthProviderId: 'clerk_bench_owner' },
    select: { id: true },
  });
  const largeTenantOwnerMembership = largeTenant && benchOwner
    ? await prisma.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: largeTenant.id,
            userId: benchOwner.id,
          },
        },
        select: { userId: true },
      })
    : null;
  const assignee = largeTenant
    ? await prisma.ticket.findFirst({
        where: {
          tenantId: largeTenant.id,
          assigneeUserId: { not: null },
        },
        select: { assigneeUserId: true },
      })
    : null;

  const counts = {
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

  console.log(
    JSON.stringify(
      {
        benchmarkTenant: largeTenant
          ? {
              id: largeTenant.id,
              slug: largeTenant.slug,
              bearerToken: 'clerk_bench_owner',
              ownerUserId: largeTenantOwnerMembership?.userId ?? null,
              assigneeUserId: assignee?.assigneeUserId ?? null,
            }
          : null,
        counts,
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
