import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/core/config/env.js';
import { createLogger } from '../src/core/logger/logger.js';
import type { Database } from '../src/database/client.js';
import { hashPassword } from '../src/modules/auth/password.js';
import type { UserRole } from '../src/modules/users/user-model.js';
import type pg from 'pg';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

describe('admin authentication and RBAC', () => {
  it('logs in with valid credentials and exposes current user', async () => {
    const app = await createAuthTestApp();
    const cookie = await login(app, 'admin@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/me',
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.equal((response.json() as { user: { role: string } }).user.role, 'Admin');
    await app.close();
  });

  it('rejects invalid login credentials', async () => {
    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: {
        email: 'admin@example.com',
        password: 'wrong-password'
      }
    });

    assert.equal(response.statusCode, 401);
    assert.equal(
      (response.json() as { error: { code: string } }).error.code,
      'INVALID_CREDENTIALS'
    );
    await app.close();
  });

  it('logs out and revokes the session', async () => {
    const app = await createAuthTestApp();
    const cookie = await login(app, 'admin@example.com', 'test-password-123');
    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/logout',
      headers: { cookie }
    });
    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/me',
      headers: { cookie }
    });

    assert.equal(logoutResponse.statusCode, 200);
    assert.equal(meResponse.statusCode, 401);
    await app.close();
  });

  it('blocks protected admin routes without a session', async () => {
    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/organizations'
    });

    assert.equal(response.statusCode, 401);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'AUTH_REQUIRED');
    await app.close();
  });

  it('allows organization access for the user organization', async () => {
    const app = await createAuthTestApp();
    const cookie = await login(app, 'admin@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/sites?organizationId=${ORG_A}`,
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.equal((response.json() as { sites: unknown[] }).sites.length, 1);
    await app.close();
  });

  it('denies organization access for another organization', async () => {
    const app = await createAuthTestApp();
    const cookie = await login(app, 'admin@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/sites?organizationId=${ORG_B}`,
      headers: { cookie }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(
      (response.json() as { error: { code: string } }).error.code,
      'ORGANIZATION_ACCESS_DENIED'
    );
    await app.close();
  });

  it('allows SuperAdmin to access every organization', async () => {
    const app = await createAuthTestApp();
    const cookie = await login(app, 'super@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'GET',
      url: `/api/admin/sites?organizationId=${ORG_B}`,
      headers: { cookie }
    });

    assert.equal(response.statusCode, 200);
    assert.equal((response.json() as { sites: unknown[] }).sites.length, 1);
    await app.close();
  });

  it('blocks Viewer from modifying sites', async () => {
    const app = await createAuthTestApp();
    const cookie = await login(app, 'viewer@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/sites',
      headers: { cookie },
      payload: {
        organizationId: ORG_A,
        name: 'Viewer Site',
        slug: 'viewer-site',
        businessConfigId: 'default'
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'PERMISSION_DENIED');
    await app.close();
  });
});

async function createAuthTestApp() {
  return createApp({
    config: loadConfig({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://visitor_os:visitor_os@localhost:5432/visitor_os',
      ADMIN_SESSION_SECRET: 'test-session-secret-with-more-than-32-characters',
      ADMIN_SESSION_RENEWAL_MS: '999999999'
    }),
    database: await createAuthMemoryDatabase(),
    logger: createLogger()
  });
}

async function login(
  app: Awaited<ReturnType<typeof createAuthTestApp>>,
  email: string,
  password: string
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/auth/login',
    payload: { email, password }
  });
  assert.equal(response.statusCode, 200);
  const cookie = response.headers['set-cookie'];
  if (typeof cookie !== 'string') {
    throw new Error('Login did not return a session cookie');
  }

  return cookie;
}

async function createAuthMemoryDatabase(): Promise<Database> {
  const organizations = new Map<string, Record<string, unknown>>([
    [ORG_A, organization(ORG_A, 'Org A', 'org-a')],
    [ORG_B, organization(ORG_B, 'Org B', 'org-b')]
  ]);
  const sites = new Map<string, Record<string, unknown>>([
    ['site-a', site('site-a', ORG_A, 'Site A', 'site-a')],
    ['site-b', site('site-b', ORG_B, 'Site B', 'site-b')]
  ]);
  const users = new Map<string, Record<string, unknown>>();
  const sessions = new Map<string, Record<string, unknown>>();

  await addUser(users, 'user-admin', ORG_A, 'admin@example.com', 'Admin');
  await addUser(users, 'user-super', ORG_A, 'super@example.com', 'SuperAdmin');
  await addUser(users, 'user-viewer', ORG_A, 'viewer@example.com', 'Viewer');

  return {
    async checkConnection() {},
    async close() {},
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.toLowerCase();

      if (sql.includes('from users where lower(email)')) {
        return result(
          [...users.values()].filter(
            (row) => String(row.email).toLowerCase() === String(values[0]).toLowerCase()
          )
        );
      }

      if (sql.includes('from users where id')) {
        return result(optional(users.get(String(values[0]))));
      }

      if (sql.includes('insert into admin_sessions')) {
        const row = {
          id: values[0],
          user_id: values[1],
          organization_id: values[2],
          token_hash: values[3],
          expires_at: values[4],
          created_at: new Date(),
          renewed_at: new Date(),
          revoked_at: null
        };
        sessions.set(String(row.token_hash), row);
        return result([row]);
      }

      if (sql.includes('from admin_sessions')) {
        const row = sessions.get(String(values[0]));
        if (!row || row.revoked_at) return result([]);

        return result([row]);
      }

      if (sql.includes('update admin_sessions set revoked_at')) {
        const row = sessions.get(String(values[0]));
        if (row) row.revoked_at = new Date();
        return result([]);
      }

      if (sql.includes('from sites where organization_id')) {
        return result([...sites.values()].filter((row) => row.organization_id === values[0]));
      }

      if (sql.includes('from organizations where id')) {
        return result(optional(organizations.get(String(values[0]))));
      }

      if (sql.includes('from organizations order by')) {
        return result([...organizations.values()]);
      }

      return result([]);
    }
  };
}

async function addUser(
  users: Map<string, Record<string, unknown>>,
  id: string,
  organizationId: string,
  email: string,
  role: UserRole
): Promise<void> {
  users.set(id, {
    id,
    organization_id: organizationId,
    first_name: role,
    last_name: 'User',
    email,
    password_hash: await hashPassword('test-password-123'),
    role,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date()
  });
}

function organization(id: string, name: string, slug: string): Record<string, unknown> {
  return {
    id,
    name,
    slug,
    description: null,
    email: null,
    phone: null,
    country: 'FR',
    language: 'fr',
    timezone: 'Europe/Paris',
    currency: 'EUR',
    status: 'active',
    subscription_status: null,
    ai_quota: null,
    conversation_quota: null,
    storage_quota_mb: null,
    plan: null,
    created_at: new Date()
  };
}

function site(
  id: string,
  organizationId: string,
  name: string,
  slug: string
): Record<string, unknown> {
  return {
    id,
    organization_id: organizationId,
    name,
    slug,
    domain: null,
    widget_public_key: `${slug}-key`,
    activity: 'default',
    business_config_id: 'default',
    language: 'fr',
    status: 'active',
    widget_enabled: true,
    created_at: new Date()
  };
}

function optional<T>(value: T | undefined): T[] {
  return value ? [value] : [];
}

function result<T extends pg.QueryResultRow = pg.QueryResultRow>(
  rows: Array<Record<string, unknown>>
): pg.QueryResult<T> {
  return {
    rows: rows as T[],
    command: '',
    rowCount: rows.length,
    oid: 0,
    fields: []
  };
}
