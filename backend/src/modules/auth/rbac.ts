import type { UserRole } from '../users/user-model.js';

export type Permission =
  | 'organizations:read'
  | 'organizations:write'
  | 'sites:read'
  | 'sites:write'
  | 'conversations:read'
  | 'conversations:write'
  | 'prospects:read'
  | 'prospects:write'
  | 'data:export'
  | 'settings:access';

const allPermissions: readonly Permission[] = [
  'organizations:read',
  'organizations:write',
  'sites:read',
  'sites:write',
  'conversations:read',
  'conversations:write',
  'prospects:read',
  'prospects:write',
  'data:export',
  'settings:access'
] as const;

export const rolePermissions: Record<UserRole, readonly Permission[]> = {
  SuperAdmin: allPermissions,
  Admin: allPermissions.filter((permission) => permission !== 'organizations:write'),
  Manager: [
    'organizations:read',
    'sites:read',
    'sites:write',
    'conversations:read',
    'conversations:write',
    'prospects:read',
    'prospects:write',
    'data:export',
    'settings:access'
  ],
  Agent: [
    'sites:read',
    'conversations:read',
    'conversations:write',
    'prospects:read',
    'prospects:write'
  ],
  Viewer: ['sites:read', 'conversations:read', 'prospects:read']
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return rolePermissions[role];
}
