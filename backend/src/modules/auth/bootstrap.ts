import type { AppConfig } from '../../core/config/env.js';
import type { Database } from '../../database/client.js';
import { hashPassword } from './password.js';
import { UserRepository } from '../users/user-repository.js';

const DEFAULT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

export async function seedFirstAdmin(database: Database, config: AppConfig): Promise<void> {
  const firstAdmin = config.auth.firstAdmin;
  if (!firstAdmin) return;

  const users = new UserRepository(database);
  const existing = await users.findByEmail(firstAdmin.email);
  if (existing) return;

  await users.create({
    organizationId: firstAdmin.organizationId ?? DEFAULT_ORGANIZATION_ID,
    firstName: firstAdmin.firstName,
    lastName: firstAdmin.lastName,
    email: firstAdmin.email,
    passwordHash: await hashPassword(firstAdmin.password),
    role: 'SuperAdmin'
  });
}
