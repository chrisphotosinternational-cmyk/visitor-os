import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { ConversationRepository } from '../src/modules/conversations/conversation-repository.js';
import { OrganizationRepository } from '../src/modules/organizations/organization-repository.js';
import { SiteRepository } from '../src/modules/sites/site-repository.js';

describe('multi-tenant foundation', () => {
  it('creates organizations and sites with configuration association', async () => {
    const database = createTenantMemoryDatabase();
    const organizations = new OrganizationRepository(database);
    const sites = new SiteRepository(database);

    const organization = await organizations.create({
      name: 'Tenant A',
      slug: 'tenant-a',
      email: 'tenant-a@example.com'
    });
    const site = await sites.create({
      organizationId: organization.id,
      name: 'Tenant A Site',
      slug: 'tenant-a-site',
      widgetPublicKey: 'tenant-a-widget',
      businessConfigId: 'cherche-midi'
    });

    assert.equal(site.organization_id, organization.id);
    assert.equal(site.business_config_id, 'cherche-midi');
    assert.equal(site.widget_enabled, true);
  });

  it('resolves widget site by slug and public key', async () => {
    const database = createTenantMemoryDatabase();
    const conversations = new ConversationRepository(database);
    const organizations = new OrganizationRepository(database);
    const sites = new SiteRepository(database);
    const organization = await organizations.create({ name: 'Tenant B', slug: 'tenant-b' });
    const site = await sites.create({
      organizationId: organization.id,
      name: 'Tenant B Site',
      slug: 'tenant-b-site',
      widgetPublicKey: 'tenant-b-widget',
      businessConfigId: 'photographe-glamour'
    });

    assert.equal((await conversations.findSiteBySlug('tenant-b-site'))?.id, site.id);
    assert.equal((await conversations.findSiteByWidgetKey('tenant-b-widget'))?.id, site.id);
  });

  it('filters sites by organization to prepare tenant isolation', async () => {
    const database = createTenantMemoryDatabase();
    const organizations = new OrganizationRepository(database);
    const sites = new SiteRepository(database);
    const first = await organizations.create({ name: 'Tenant C', slug: 'tenant-c' });
    const second = await organizations.create({ name: 'Tenant D', slug: 'tenant-d' });
    await sites.create({
      organizationId: first.id,
      name: 'First Site',
      slug: 'first-site',
      businessConfigId: 'default'
    });
    await sites.create({
      organizationId: second.id,
      name: 'Second Site',
      slug: 'second-site',
      businessConfigId: 'decoration-murale'
    });

    const firstSites = await sites.list(first.id);

    assert.equal(firstSites.length, 1);
    assert.equal(firstSites[0]?.organization_id, first.id);
  });
});

function createTenantMemoryDatabase(): Database {
  const organizations = new Map<string, Record<string, unknown>>();
  const sites = new Map<string, Record<string, unknown>>();

  return {
    async checkConnection() {},
    async close() {},
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.toLowerCase();

      if (sql.includes('insert into organizations')) {
        const row = {
          id: values[0],
          name: values[1],
          slug: values[2],
          description: values[3] ?? null,
          email: values[4] ?? null,
          phone: values[5] ?? null,
          country: values[6],
          language: values[7],
          timezone: values[8],
          currency: values[9],
          status: values[10],
          subscription_status: null,
          ai_quota: null,
          conversation_quota: null,
          storage_quota_mb: null,
          plan: values[11] ?? null,
          created_at: new Date()
        };
        organizations.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('insert into sites')) {
        const row = {
          id: values[0],
          organization_id: values[1],
          name: values[2],
          slug: values[3],
          domain: values[4] ?? null,
          widget_public_key: values[5],
          activity: values[6],
          business_config_id: values[6],
          language: values[7],
          status: values[8],
          widget_enabled: values[9],
          created_at: new Date()
        };
        sites.set(String(row.id), row);
        return result([row]);
      }

      if (sql.includes('from sites where widget_public_key')) {
        return result([...sites.values()].filter((site) => site.widget_public_key === values[0]));
      }

      if (sql.includes('from sites where slug')) {
        return result([...sites.values()].filter((site) => site.slug === values[0]));
      }

      if (sql.includes('from sites where organization_id')) {
        return result([...sites.values()].filter((site) => site.organization_id === values[0]));
      }

      if (sql.includes('from sites order by')) {
        return result([...sites.values()]);
      }

      return result([]);
    }
  };
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
