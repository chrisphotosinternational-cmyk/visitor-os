import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/core/config/env.js';
import { createLogger } from '../src/core/logger/logger.js';
import type { Database } from '../src/database/client.js';
import { signJwt } from '../src/modules/auth/jwt.js';
import { hashPassword } from '../src/modules/auth/password.js';
import type { UserRole } from '../src/modules/users/user-model.js';
import type pg from 'pg';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

describe('admin authentication and RBAC', () => {
  it('logs in with valid JWT credentials and reads /me', async () => {
    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'admin@example.com',
        password: 'test-password-123'
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { token: string; user: { email: string } };
    assert.equal(body.user.email, 'admin@example.com');
    assert.ok(body.token);

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${body.token}` }
    });

    assert.equal(me.statusCode, 200);
    assert.equal((me.json() as { user: { email: string } }).user.email, 'admin@example.com');
    await app.close();
  });

  it('rejects invalid JWT login credentials', async () => {
    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/login',
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

  it('rejects expired JWT tokens', async () => {
    const app = await createAuthTestApp();
    const token = signJwt(
      {
        sub: 'user-admin',
        organizationId: ORG_A,
        email: 'admin@example.com',
        role: 'Admin'
      },
      'test-session-secret-with-more-than-32-characters',
      -1
    );
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(response.statusCode, 401);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'TOKEN_EXPIRED');
    await app.close();
  });

  it('blocks /dashboard without JWT', async () => {
    const app = await createAuthTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard'
    });

    assert.equal(response.statusCode, 401);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'JWT_REQUIRED');
    await app.close();
  });

  it('allows /dashboard with JWT', async () => {
    const app = await createAuthTestApp();
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/login',
      payload: {
        email: 'admin@example.com',
        password: 'test-password-123'
      }
    });
    const token = (loginResponse.json() as { token: string }).token;
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(response.statusCode, 200);
    assert.equal((response.json() as { status: string }).status, 'ok');
    await app.close();
  });

  it('lists and creates organizations through JWT admin management', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'super@example.com', 'test-password-123');
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin-api/organizations',
      headers: { authorization: `Bearer ${token}` }
    });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin-api/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Org C',
        slug: 'org-c',
        email: 'contact@org-c.test'
      }
    });

    assert.equal(listResponse.statusCode, 200);
    assert.equal((listResponse.json() as { organizations: unknown[] }).organizations.length, 2);
    assert.equal(createResponse.statusCode, 200);
    assert.equal(
      (createResponse.json() as { organization: { slug: string } }).organization.slug,
      'org-c'
    );
    await app.close();
  });

  it('keeps Admin organization management isolated to its organization', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin-api/organizations',
      headers: { authorization: `Bearer ${token}` }
    });
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin-api/organizations',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Blocked', slug: 'blocked' }
    });

    assert.equal(listResponse.statusCode, 200);
    assert.deepEqual(
      (listResponse.json() as { organizations: Array<{ id: string }> }).organizations.map(
        (organization) => organization.id
      ),
      [ORG_A]
    );
    assert.equal(createResponse.statusCode, 403);
    assert.equal(
      (createResponse.json() as { error: { code: string } }).error.code,
      'PERMISSION_DENIED'
    );
    await app.close();
  });

  it('creates users with roles through JWT admin management', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'super@example.com', 'test-password-123');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin-api/users',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: ORG_A,
        firstName: 'New',
        lastName: 'Manager',
        email: 'manager@example.com',
        password: 'test-password-123',
        role: 'Manager'
      }
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin-api/users',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(createResponse.statusCode, 200);
    assert.equal((createResponse.json() as { user: { role: string } }).user.role, 'Manager');
    assert.ok(
      (listResponse.json() as { users: Array<{ email: string }> }).users.some(
        (user) => user.email === 'manager@example.com'
      )
    );
    await app.close();
  });

  it('blocks cross-organization user creation for Admin', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/users',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: ORG_B,
        firstName: 'Other',
        lastName: 'Tenant',
        email: 'other@example.com',
        password: 'test-password-123',
        role: 'Viewer'
      }
    });

    assert.equal(response.statusCode, 403);
    assert.equal(
      (response.json() as { error: { code: string } }).error.code,
      'ORGANIZATION_ACCESS_DENIED'
    );
    await app.close();
  });

  it('blocks Viewer from JWT admin management routes', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'viewer@example.com', 'test-password-123');
    const response = await app.inject({
      method: 'GET',
      url: '/admin-api/users',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(response.statusCode, 403);
    assert.equal((response.json() as { error: { code: string } }).error.code, 'PERMISSION_DENIED');
    await app.close();
  });

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

async function jwtLogin(
  app: Awaited<ReturnType<typeof createAuthTestApp>>,
  email: string,
  password: string
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email, password }
  });
  assert.equal(response.statusCode, 200);

  return (response.json() as { token: string }).token;
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
    isConfigured: () => true,
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
            (row) => valueToString(row.email).toLowerCase() === valueToString(values[0]).toLowerCase()
          )
        );
      }

      if (sql.includes('from users where id')) {
        return result(optional(users.get(String(values[0]))));
      }

      if (sql.includes('select count(*)::text as count from users')) {
        const organizationId = values[0] ? valueToString(values[0]) : null;
        return result([
          {
            count: String(
              [...users.values()].filter(
                (row) => !organizationId || row.organization_id === organizationId
              ).length
            )
          }
        ]);
      }

      if (sql.includes('from users') && sql.includes('order by created_at')) {
        const organizationId = values[0] ? valueToString(values[0]) : null;
        const search = valueToString(values[1] ?? '').replaceAll('%', '').toLowerCase();
        return result(
          [...users.values()].filter(
            (row) =>
              (!organizationId || row.organization_id === organizationId) &&
              (!search ||
                valueToString(row.email).toLowerCase().includes(search) ||
                valueToString(row.first_name).toLowerCase().includes(search) ||
                valueToString(row.last_name).toLowerCase().includes(search))
          )
        );
      }

      if (sql.includes('insert into users')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          first_name: values[2],
          last_name: values[3],
          email: values[4],
          password_hash: values[5],
          role: values[6],
          status: values[7],
          created_at: new Date(),
          updated_at: new Date()
        };
        users.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('update users set status')) {
        const row = users.get(String(values[1]));
        if (!row) return result([]);
        row.status = values[0];
        row.updated_at = new Date();
        return result([row]);
      }

      if (sql.includes('update users')) {
        const row = users.get(String(values[7]));
        if (!row) return result([]);
        Object.assign(row, {
          organization_id: values[0],
          first_name: values[1],
          last_name: values[2],
          email: values[3],
          role: values[4],
          status: values[5],
          password_hash: values[6] ?? row.password_hash,
          updated_at: new Date()
        });
        return result([row]);
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

      if (sql.includes('select count(*)::text as count from organizations')) {
        return result([
          {
            count: String(
              [...organizations.values()].filter((row) => row.status !== 'deleted').length
            )
          }
        ]);
      }

      if (sql.includes('from organizations where id')) {
        return result(optional(organizations.get(String(values[0]))));
      }

      if (sql.includes('from organizations') && sql.includes('order by created_at')) {
        const search = valueToString(values[0] ?? '').replaceAll('%', '').toLowerCase();
        return result(
          [...organizations.values()].filter(
            (row) =>
              row.status !== 'deleted' &&
              (!search ||
                valueToString(row.name).toLowerCase().includes(search) ||
                valueToString(row.slug).toLowerCase().includes(search) ||
                valueToString(row.email ?? '').toLowerCase().includes(search))
          )
        );
      }

      if (sql.includes('insert into organizations')) {
        const row = organization(String(values[0]), String(values[1]), String(values[2]));
        row.description = values[3] ?? null;
        row.email = values[4] ?? null;
        row.phone = values[5] ?? null;
        row.country = values[6] ?? 'FR';
        row.language = values[7] ?? 'fr';
        row.timezone = values[8] ?? 'Europe/Paris';
        row.currency = values[9] ?? 'EUR';
        row.status = values[10] ?? 'active';
        row.plan = values[11] ?? null;
        organizations.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('update organizations') && sql.includes("status = 'deleted'")) {
        const row = organizations.get(String(values[0]));
        if (!row) return { ...result([]), rowCount: 0 };
        row.status = 'deleted';
        return { ...result([]), rowCount: 1 };
      }

      if (sql.includes('update organizations') && sql.includes('set status =')) {
        const row = organizations.get(String(values[1]));
        if (!row) return result([]);
        row.status = values[0];
        return result([row]);
      }

      if (sql.includes('update organizations')) {
        const row = organizations.get(String(values[11]));
        if (!row) return result([]);
        Object.assign(row, {
          name: values[0],
          slug: values[1],
          description: values[2],
          email: values[3],
          phone: values[4],
          country: values[5],
          language: values[6],
          timezone: values[7],
          currency: values[8],
          status: values[9],
          plan: values[10]
        });
        return result([row]);
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

function valueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }

  return '';
}
