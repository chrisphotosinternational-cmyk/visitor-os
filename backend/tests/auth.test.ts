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

  it('creates and lists prospects through JWT admin management', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/admin-api/prospects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: ORG_A,
        firstName: 'Emma',
        lastName: 'Studio',
        pseudo: 'emma_photo',
        email: 'emma@example.com',
        phone: '+33600000000',
        city: 'Albi',
        instagram: '@emma',
        mym: 'emma-mym',
        website: 'https://emma.example',
        description: 'Photographe portrait et studio a Albi',
        status: 'to_contact'
      }
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin-api/prospects?search=emma',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(createResponse.statusCode, 200);
    assert.equal((createResponse.json() as { prospect: { score_label: string } }).prospect.score_label, 'very_high');
    assert.equal(listResponse.statusCode, 200);
    assert.equal((listResponse.json() as { prospects: unknown[] }).prospects.length, 1);
    await app.close();
  });

  it('keeps prospects isolated by organization', async () => {
    const app = await createAuthTestApp();
    const adminToken = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const superToken = await jwtLogin(app, 'super@example.com', 'test-password-123');
    await app.inject({
      method: 'POST',
      url: '/admin-api/prospects',
      headers: { authorization: `Bearer ${superToken}` },
      payload: {
        organizationId: ORG_B,
        pseudo: 'tenant_b',
        city: 'Toulouse',
        email: 'tenant-b@example.com'
      }
    });
    const adminList = await app.inject({
      method: 'GET',
      url: '/admin-api/prospects',
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.equal(adminList.statusCode, 200);
    assert.equal((adminList.json() as { prospects: Array<{ organization_id: string }> }).prospects.length, 0);
    await app.close();
  });

  it('imports CSV prospects, deduplicates and merges missing data', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const csv = [
      'pseudo,email,phone,city,instagram,source_url,description',
      'alice,alice@example.com,,Albi,@alice,https://source/a,Portrait mode et studio',
      'alice,alice@example.com,+33700000000,Albi,@alice,https://source/a,Portrait mode et studio detaille avec booking'
    ].join('\n');
    const response = await app.inject({
      method: 'POST',
      url: '/admin-api/prospects/import-csv',
      headers: { authorization: `Bearer ${token}` },
      payload: { csv }
    });
    const listResponse = await app.inject({
      method: 'GET',
      url: '/admin-api/prospects?search=alice',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(response.statusCode, 200);
    const importResult = response.json() as { import: { created: number; merged: number; rows: number } };
    assert.equal(importResult.import.created, 1);
    assert.equal(importResult.import.merged, 1);
    assert.equal(importResult.import.rows, 2);
    const prospects = (listResponse.json() as { prospects: Array<{ phone: string }> }).prospects;
    assert.equal(prospects.length, 1);
    assert.equal(prospects[0]?.phone, '+33700000000');
    await app.close();
  });

  it('filters and exports prospects as CSV', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    await app.inject({
      method: 'POST',
      url: '/admin-api/prospects',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        organizationId: ORG_A,
        pseudo: 'mym_creator',
        email: 'creator@example.com',
        city: 'Albi',
        mym: 'creator-mym',
        status: 'interested'
      }
    });
    const filtered = await app.inject({
      method: 'GET',
      url: '/admin-api/prospects?status=interested&platform=mym',
      headers: { authorization: `Bearer ${token}` }
    });
    const exported = await app.inject({
      method: 'GET',
      url: '/admin-api/prospects/export-csv?status=interested',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(filtered.statusCode, 200);
    assert.equal((filtered.json() as { prospects: unknown[] }).prospects.length, 1);
    assert.equal(exported.statusCode, 200);
    assert.match(exported.body, /creator@example.com/);
    await app.close();
  });

  it('creates contact history and updates prospect status automatically', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const prospect = await createTestProspect(app, token, {
      organizationId: ORG_A,
      pseudo: 'follow_creator',
      email: 'follow@example.com',
      city: 'Albi'
    });
    const response = await app.inject({
      method: 'POST',
      url: `/admin-api/prospects/${prospect.id}/history`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        channel: 'email',
        outcome: 'interested',
        messageUsed: 'Bonjour, votre profil nous interesse.',
        response: 'Oui, envoyez les infos.',
        notes: 'Bon signal'
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal((response.json() as { prospect: { status: string } }).prospect.status, 'interested');
    await app.close();
  });

  it('keeps contact history isolated by organization', async () => {
    const app = await createAuthTestApp();
    const adminToken = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const superToken = await jwtLogin(app, 'super@example.com', 'test-password-123');
    const prospect = await createTestProspect(app, superToken, {
      organizationId: ORG_B,
      pseudo: 'tenant_b_history',
      email: 'history-b@example.com'
    });
    const response = await app.inject({
      method: 'GET',
      url: `/admin-api/prospects/${prospect.id}/history`,
      headers: { authorization: `Bearer ${adminToken}` }
    });

    assert.equal(response.statusCode, 404);
    await app.close();
  });

  it('lists follow-ups and exports contact history', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const prospect = await createTestProspect(app, token, {
      organizationId: ORG_A,
      pseudo: 'reminder_creator',
      email: 'reminder@example.com',
      city: 'Albi'
    });
    await app.inject({
      method: 'POST',
      url: `/admin-api/prospects/${prospect.id}/history`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        channel: 'instagram_manual',
        outcome: 'follow_up_needed',
        nextAction: 'Relancer demain',
        followUpDate: new Date(Date.now() - 60_000).toISOString(),
        notes: 'Premiere relance'
      }
    });
    const followUps = await app.inject({
      method: 'GET',
      url: '/admin-api/contact-history/follow-ups?overdue=true',
      headers: { authorization: `Bearer ${token}` }
    });
    const exported = await app.inject({
      method: 'GET',
      url: '/admin-api/contact-history/export-csv?overdue=true',
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(followUps.statusCode, 200);
    assert.equal((followUps.json() as { followUps: unknown[] }).followUps.length, 1);
    assert.equal(exported.statusCode, 200);
    assert.match(exported.body, /Relancer demain/);
    await app.close();
  });

  it('deletes contact history entries', async () => {
    const app = await createAuthTestApp();
    const token = await jwtLogin(app, 'admin@example.com', 'test-password-123');
    const prospect = await createTestProspect(app, token, {
      organizationId: ORG_A,
      pseudo: 'delete_history',
      email: 'delete-history@example.com'
    });
    const created = await app.inject({
      method: 'POST',
      url: `/admin-api/prospects/${prospect.id}/history`,
      headers: { authorization: `Bearer ${token}` },
      payload: { channel: 'phone', outcome: 'no_response' }
    });
    const entryId = (created.json() as { entry: { id: string } }).entry.id;
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/admin-api/contact-history/${entryId}`,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(deleted.statusCode, 200);
    assert.equal((deleted.json() as { deleted: boolean }).deleted, true);
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

async function createTestProspect(
  app: Awaited<ReturnType<typeof createAuthTestApp>>,
  token: string,
  payload: Record<string, unknown>
): Promise<{ id: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/admin-api/prospects',
    headers: { authorization: `Bearer ${token}` },
    payload
  });
  assert.equal(response.statusCode, 200);

  return (response.json() as { prospect: { id: string } }).prospect;
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
  const prospects = new Map<string, Record<string, unknown>>();
  const contactHistory = new Map<string, Record<string, unknown>>();

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

      if (sql.includes('from contact_history') && sql.includes('total_contacts')) {
        const organizationId = values[0] ? valueToString(values[0]) : null;
        const rows = filterContactHistory(contactHistory, organizationId);
        const now = Date.now();
        const today = new Date().toISOString().slice(0, 10);
        const positive = rows.filter((row) =>
          ['positive', 'interested', 'booked'].includes(valueToString(row.outcome))
        ).length;
        return result([
          {
            due_today: String(rows.filter((row) => dateKey(row.follow_up_date) === today).length),
            overdue: String(rows.filter((row) => toTime(row.follow_up_date) < now).length),
            no_response: String(rows.filter((row) => row.outcome === 'no_response').length),
            interested: String(rows.filter((row) => row.outcome === 'interested').length),
            positive: String(positive),
            total_contacts: String(rows.length),
            contacts_this_week: String(rows.length),
            never_contacted: String(
              filterProspects(prospects, organizationId).filter(
                (prospect) => !rows.some((row) => row.prospect_id === prospect.id)
              ).length
            )
          }
        ]);
      }

      if (sql.includes('from contact_history') && sql.includes('join prospects')) {
        const organizationId = values[0] ? valueToString(values[0]) : null;
        const overdueOnly = values[1] === true;
        const upcomingOnly = values[2] === true;
        const city = valueToString(values[3] ?? '').replaceAll('%', '').toLowerCase();
        const scoreLabel = values[4] ? valueToString(values[4]) : null;
        const status = values[5] ? valueToString(values[5]) : null;
        const now = Date.now();
        return result(
          filterContactHistory(contactHistory, organizationId)
            .filter((row) => row.follow_up_date)
            .map((row): Record<string, unknown> => {
              const prospect = prospects.get(String(row.prospect_id));
              return {
                ...row,
                prospect_display_name: prospect?.display_name ?? null,
                prospect_city: prospect?.city ?? null,
                prospect_score: prospect?.score ?? null,
                prospect_status: prospect?.status ?? null,
                prospect_score_label: prospect?.score_label ?? null
              };
            })
            .filter(
              (row) =>
                (!overdueOnly || toTime(row.follow_up_date) < now) &&
                (!upcomingOnly || toTime(row.follow_up_date) >= now) &&
                (!city || valueToString(row.prospect_city).toLowerCase().includes(city)) &&
                (!scoreLabel || row.prospect_score_label === scoreLabel) &&
                (!status || row.prospect_status === status)
            )
        );
      }

      if (sql.includes('from contact_history') && sql.includes('where prospect_id')) {
        const prospectId = valueToString(values[0]);
        const organizationId = values[1] ? valueToString(values[1]) : null;
        return result(
          [...contactHistory.values()].filter(
            (row) =>
              row.prospect_id === prospectId &&
              (!organizationId || row.organization_id === organizationId)
          )
        );
      }

      if (sql.includes('insert into contact_history')) {
        const row = contactHistoryFromValues(values);
        contactHistory.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('update contact_history')) {
        const row = contactHistory.get(String(values[8]));
        const organizationId = values[9] ? valueToString(values[9]) : null;
        if (!row || (organizationId && row.organization_id !== organizationId)) return result([]);
        Object.assign(row, contactHistoryUpdateFromValues(values), { updated_at: new Date() });
        return result([row]);
      }

      if (sql.includes('delete from contact_history')) {
        const row = contactHistory.get(String(values[0]));
        const organizationId = values[1] ? valueToString(values[1]) : null;
        if (!row || (organizationId && row.organization_id !== organizationId)) {
          return { ...result([]), rowCount: 0 };
        }
        contactHistory.delete(String(values[0]));
        return { ...result([]), rowCount: 1 };
      }

      if (sql.includes('update prospects') && sql.includes('set status = coalesce')) {
        const prospect = prospects.get(String(values[1]));
        if (prospect && prospect.organization_id === values[2] && values[0]) {
          prospect.status = values[0];
          prospect.updated_at = new Date();
        }
        return result([]);
      }

      if (sql.includes('from prospects') && sql.includes('count(*) filter')) {
        const organizationId = values[0] ? valueToString(values[0]) : null;
        const rows = filterProspects(prospects, organizationId);
        return result([
          {
            total: String(rows.length),
            to_contact: String(rows.filter((row) => ['to_contact', 'follow_up'].includes(valueToString(row.status))).length),
            interested: String(rows.filter((row) => ['interested', 'potential_client'].includes(valueToString(row.status))).length),
            blacklist: String(rows.filter((row) => row.status === 'blacklist').length),
            high_score: String(rows.filter((row) => ['high', 'very_high'].includes(valueToString(row.score_label))).length),
            with_email: String(rows.filter((row) => Boolean(row.email)).length),
            with_phone: String(rows.filter((row) => Boolean(row.phone)).length),
            premium_platforms: String(rows.filter((row) => Boolean(row.mym) || Boolean(row.onlyfans)).length)
          }
        ]);
      }

      if (sql.includes('from prospects') && sql.includes('group by city')) {
        const organizationId = values[0] ? valueToString(values[0]) : null;
        const counts = new Map<string, number>();
        for (const row of filterProspects(prospects, organizationId)) {
          const city = valueToString(row.city);
          if (city) counts.set(city, (counts.get(city) ?? 0) + 1);
        }
        return result(
          [...counts.entries()].map(([city, count]) => ({ city, count: String(count) }))
        );
      }

      if (sql.includes('select count(*)::text as count from prospects')) {
        const rows = filterProspectsForCore(prospects, values);
        return result([{ count: String(rows.length) }]);
      }

      if (sql.includes('select *') && sql.includes('from prospects') && sql.includes('where organization_id')) {
        const duplicate = [...prospects.values()].find(
          (row) =>
            row.organization_id === values[0] &&
            ((values[1] && valueToString(row.email).toLowerCase() === valueToString(values[1]).toLowerCase()) ||
              (values[2] && row.phone === values[2]) ||
              (values[3] && row.source_url === values[3]) ||
              (values[4] &&
                values[5] &&
                valueToString(row.pseudo).toLowerCase() === valueToString(values[4]).toLowerCase() &&
                valueToString(row.city).toLowerCase() === valueToString(values[5]).toLowerCase()))
        );
        return result(optional(duplicate));
      }

      if (sql.includes('select *') && sql.includes('from prospects') && sql.includes('order by updated_at')) {
        const rows = filterProspectsForCore(prospects, values);
        return result(rows);
      }

      if (sql.includes('select * from prospects where id')) {
        const prospect = prospects.get(String(values[0]));
        const organizationId = values[1] ? valueToString(values[1]) : null;
        return result(optional(prospect && (!organizationId || prospect.organization_id === organizationId) ? prospect : undefined));
      }

      if (sql.includes('insert into prospects')) {
        const row = prospectFromValues(values);
        prospects.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('update prospects') && sql.includes('set') && sql.includes('display_name')) {
        const row = prospects.get(String(values[24]));
        const organizationId = values[25] ? valueToString(values[25]) : null;
        if (!row || (organizationId && row.organization_id !== organizationId)) return result([]);
        Object.assign(row, prospectUpdateFromValues(values), { updated_at: new Date() });
        return result([row]);
      }

      if (sql.includes('delete from prospects')) {
        const row = prospects.get(String(values[0]));
        const organizationId = values[1] ? valueToString(values[1]) : null;
        if (!row || (organizationId && row.organization_id !== organizationId)) {
          return { ...result([]), rowCount: 0 };
        }
        prospects.delete(String(values[0]));
        return { ...result([]), rowCount: 1 };
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

function prospectFromValues(values: unknown[]): Record<string, unknown> {
  return {
    id: values[0],
    organization_id: values[1],
    site_id: null,
    visitor_id: null,
    first_name: values[2],
    last_name: values[3],
    pseudo: values[4],
    company: values[5],
    display_name: values[6],
    email: values[7],
    phone: values[8],
    website: values[9],
    instagram: values[10],
    twitter_x: values[11],
    mym: values[12],
    onlyfans: values[13],
    linktree: values[14],
    allmylinks: values[15],
    city: values[16],
    activity: values[17],
    description: values[18],
    source_url: values[19],
    status: values[20],
    temperature: 'tiede',
    score_current: values[21],
    score: values[22],
    score_label: values[23],
    notes: values[24],
    source: 'admin',
    created_at: new Date(),
    updated_at: new Date()
  };
}

function prospectUpdateFromValues(values: unknown[]): Record<string, unknown> {
  return {
    organization_id: values[0],
    first_name: values[1],
    last_name: values[2],
    pseudo: values[3],
    company: values[4],
    display_name: values[5],
    email: values[6],
    phone: values[7],
    website: values[8],
    instagram: values[9],
    twitter_x: values[10],
    mym: values[11],
    onlyfans: values[12],
    linktree: values[13],
    allmylinks: values[14],
    city: values[15],
    activity: values[16],
    description: values[17],
    source_url: values[18],
    status: values[19],
    score_current: values[20],
    score: values[21],
    score_label: values[22],
    notes: values[23]
  };
}

function filterProspects(
  prospects: Map<string, Record<string, unknown>>,
  organizationId: string | null
): Record<string, unknown>[] {
  return [...prospects.values()].filter(
    (row) => !organizationId || row.organization_id === organizationId
  );
}

function filterProspectsForCore(
  prospects: Map<string, Record<string, unknown>>,
  values: unknown[]
): Record<string, unknown>[] {
  const organizationId = values[0] ? valueToString(values[0]) : null;
  const search = valueToString(values[1] ?? '').replaceAll('%', '').toLowerCase();
  const status = values[2] ? valueToString(values[2]) : null;
  const city = valueToString(values[3] ?? '').replaceAll('%', '').toLowerCase();
  const scoreLabel = values[4] ? valueToString(values[4]) : null;
  const platform = values[5] ? valueToString(values[5]) : null;

  return filterProspects(prospects, organizationId).filter((row) => {
    const searchable = [
      row.first_name,
      row.last_name,
      row.display_name,
      row.pseudo,
      row.email,
      row.phone,
      row.city
    ]
      .map(valueToString)
      .join(' ')
      .toLowerCase();

    return (
      (!search || searchable.includes(search)) &&
      (!status || row.status === status) &&
      (!city || valueToString(row.city).toLowerCase().includes(city)) &&
      (!scoreLabel || row.score_label === scoreLabel) &&
      (!platform || Boolean(row[platform]))
    );
  });
}

function contactHistoryFromValues(values: unknown[]): Record<string, unknown> {
  return {
    id: values[0],
    organization_id: values[1],
    prospect_id: values[2],
    user_id: values[3],
    contact_date: values[4] ?? new Date(),
    channel: values[5],
    message_used: values[6],
    response: values[7],
    outcome: values[8],
    next_action: values[9],
    follow_up_date: values[10],
    notes: values[11],
    created_at: new Date(),
    updated_at: new Date()
  };
}

function contactHistoryUpdateFromValues(values: unknown[]): Record<string, unknown> {
  return {
    contact_date: values[0],
    channel: values[1],
    message_used: values[2],
    response: values[3],
    outcome: values[4],
    next_action: values[5],
    follow_up_date: values[6],
    notes: values[7]
  };
}

function filterContactHistory(
  contactHistory: Map<string, Record<string, unknown>>,
  organizationId: string | null
): Record<string, unknown>[] {
  return [...contactHistory.values()].filter(
    (row) => !organizationId || row.organization_id === organizationId
  );
}

function toTime(value: unknown): number {
  if (!value) return Number.POSITIVE_INFINITY;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return Number.POSITIVE_INFINITY;
}

function dateKey(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(valueToString(value));
  return date.toISOString().slice(0, 10);
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
