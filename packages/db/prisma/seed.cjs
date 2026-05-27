const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const permissions = [
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
  ['tickets.read', 'Read ticket data when ticket tables exist'],
  ['tickets.write', 'Create and update ticket data when ticket tables exist'],
  ['internal_notes.read', 'Read internal notes when comment tables exist'],
  ['internal_notes.write', 'Write internal notes when comment tables exist'],
];

const rolePermissionKeys = {
  owner: permissions.map(([key]) => key),
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
    'tickets.read',
    'tickets.write',
    'internal_notes.read',
    'internal_notes.write',
  ],
  agent: [
    'ticket:read',
    'ticket:update',
    'ticket:assign',
    'comment:create_public',
    'comment:create_internal',
    'comment:read_internal',
    'tickets.read',
    'tickets.write',
    'internal_notes.read',
    'internal_notes.write',
  ],
  viewer: ['ticket:read', 'comment:create_public', 'tickets.read'],
};

const users = [
  ['clerk_demo_owner', 'owner@triageflow.local', 'Demo Owner', 'owner'],
  ['clerk_demo_admin', 'admin@triageflow.local', 'Demo Admin', 'admin'],
  ['clerk_demo_agent', 'agent@triageflow.local', 'Demo Agent', 'agent'],
  ['clerk_demo_viewer', 'viewer@triageflow.local', 'Demo Viewer', 'viewer'],
];

const defaultSlaPolicies = [
  ['LOW', 'Low priority default', 1440, 10080],
  ['NORMAL', 'Normal priority default', 480, 4320],
  ['HIGH', 'High priority default', 120, 1440],
  ['URGENT', 'Urgent priority default', 30, 480],
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { name: 'Demo Tenant' },
    create: { name: 'Demo Tenant', slug: 'demo' },
  });

  const permissionRecords = {};

  for (const [key, description] of permissions) {
    permissionRecords[key] = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  const roleRecords = {};
  const userRecords = {};

  for (const [key, name] of [
    ['owner', 'Owner'],
    ['admin', 'Admin'],
    ['agent', 'Agent'],
    ['viewer', 'Viewer'],
  ]) {
    roleRecords[key] = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { name },
      create: {
        tenantId: tenant.id,
        key,
        name,
        description: `${name} role for the demo tenant`,
      },
    });
  }

  for (const [roleKey, permissionKeys] of Object.entries(rolePermissionKeys)) {
    const role = roleRecords[roleKey];

    for (const permissionKey of permissionKeys) {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId: {
            tenantId: tenant.id,
            roleId: role.id,
            permissionId: permissionRecords[permissionKey].id,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: permissionRecords[permissionKey].id,
        },
      });
    }
  }

  for (const [clerkAuthProviderId, email, displayName, roleKey] of users) {
    const user = await prisma.user.upsert({
      where: { clerkAuthProviderId },
      update: { email, displayName },
      create: { clerkAuthProviderId, email, displayName },
    });
    userRecords[roleKey] = user;

    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: {
        roleId: roleRecords[roleKey].id,
        status: 'ACTIVE',
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: roleRecords[roleKey].id,
        status: 'ACTIVE',
      },
    });
  }

  for (const [priority, name, firstResponseMinutes, resolutionMinutes] of defaultSlaPolicies) {
    await prisma.slaPolicy.upsert({
      where: {
        tenantId_priority: {
          tenantId: tenant.id,
          priority,
        },
      },
      update: {
        name,
        firstResponseMinutes,
        resolutionMinutes,
        isDefault: true,
      },
      create: {
        tenantId: tenant.id,
        name,
        priority,
        firstResponseMinutes,
        resolutionMinutes,
        isDefault: true,
      },
    });
  }

  const requesterRecords = {};

  for (const [key, email, name] of [
    ['acme', 'alex.acme@example.com', 'Alex Acme'],
    ['northwind', 'nora.northwind@example.com', 'Nora Northwind'],
    ['globex', 'gabe.globex@example.com', 'Gabe Globex'],
  ]) {
    requesterRecords[key] = await prisma.requester.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: { name },
      create: {
        tenantId: tenant.id,
        email,
        name,
      },
    });
  }

  for (const ticket of [
    {
      requesterKey: 'acme',
      assigneeUserId: userRecords.agent.id,
      status: 'OPEN',
      priority: 'HIGH',
      subject: 'Cannot access shared inbox',
      description: 'The support team cannot open the shared inbox after the latest browser update.',
    },
    {
      requesterKey: 'northwind',
      assigneeUserId: userRecords.admin.id,
      status: 'PENDING_CUSTOMER',
      priority: 'NORMAL',
      subject: 'Billing contact needs to be updated',
      description: 'Please update the billing contact before the next invoice is issued.',
    },
    {
      requesterKey: 'globex',
      assigneeUserId: null,
      status: 'NEW',
      priority: 'URGENT',
      subject: 'Production login errors',
      description: 'Multiple agents are reporting login errors in the production workspace.',
    },
  ]) {
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        tenantId: tenant.id,
        subject: ticket.subject,
      },
      select: { id: true },
    });

    const data = {
      tenantId: tenant.id,
      requesterId: requesterRecords[ticket.requesterKey].id,
      assigneeUserId: ticket.assigneeUserId,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description,
    };

    if (existingTicket) {
      await prisma.ticket.update({
        where: { id: existingTicket.id },
        data,
      });
    } else {
      await prisma.ticket.create({ data });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
