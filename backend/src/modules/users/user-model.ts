export type UserRole = 'SuperAdmin' | 'Admin' | 'Manager' | 'Agent' | 'Viewer';

export const userRoles: readonly UserRole[] = [
  'SuperAdmin',
  'Admin',
  'Manager',
  'Agent',
  'Viewer'
] as const;

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

export const userStatuses: readonly UserStatus[] = [
  'active',
  'inactive',
  'invited',
  'suspended'
] as const;
