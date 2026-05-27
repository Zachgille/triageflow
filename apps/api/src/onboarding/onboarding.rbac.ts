export const onboardingPermissionDefinitions = [
  { key: 'tenant.manage', description: 'Manage tenant settings.' },
  { key: 'roles.manage', description: 'Manage tenant roles and permissions.' },
  { key: 'ticket:read', description: 'Read tenant tickets.' },
  { key: 'ticket:create', description: 'Create tenant tickets.' },
  { key: 'ticket:update', description: 'Update tenant tickets.' },
  { key: 'ticket:assign', description: 'Assign tenant tickets.' },
  { key: 'comment:create_public', description: 'Create public ticket comments.' },
  { key: 'comment:create_internal', description: 'Create internal ticket notes.' },
  { key: 'comment:read_internal', description: 'Read internal ticket notes.' },
  { key: 'analytics:read', description: 'Read tenant analytics.' },
  { key: 'tickets.read', description: 'Legacy ticket read permission.' },
  { key: 'tickets.write', description: 'Legacy ticket write permission.' },
  { key: 'internal_notes.read', description: 'Legacy internal note read permission.' },
  { key: 'internal_notes.write', description: 'Legacy internal note write permission.' },
] as const;

export const ownerPermissionKeys = onboardingPermissionDefinitions.map((permission) => permission.key);

export const adminPermissionKeys = [
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
] as const;
