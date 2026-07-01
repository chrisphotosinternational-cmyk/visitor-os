import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export type SiteStatus = 'active' | 'inactive';

export const siteStatuses: readonly SiteStatus[] = ['active', 'inactive'] as const;

export type SiteRecord = {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  domain: string | null;
  widget_public_key: string;
  activity: string;
  business_config_id: string;
  language: string;
  status: SiteStatus;
  widget_enabled: boolean;
  created_at: Date;
};

export type SiteInput = {
  organizationId: string;
  name: string;
  slug: string;
  domain?: string;
  widgetPublicKey?: string;
  businessConfigId: string;
  language?: string;
  status?: SiteStatus;
  widgetEnabled?: boolean;
};

export class SiteRepository {
  constructor(private readonly database: Database) {}

  async list(organizationId?: string): Promise<SiteRecord[]> {
    if (organizationId) {
      const result = await this.database.query<SiteRecord>(
        `select * from sites where organization_id = $1 order by created_at desc, name asc limit 100`,
        [organizationId]
      );

      return result.rows;
    }

    const result = await this.database.query<SiteRecord>(
      `select * from sites order by created_at desc, name asc limit 100`
    );

    return result.rows;
  }

  async find(id: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(`select * from sites where id = $1`, [id]);

    return result.rows[0] ?? null;
  }

  async findByWidgetPublicKey(widgetPublicKey: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `select * from sites where widget_public_key = $1 and status = 'active' and widget_enabled = true`,
      [widgetPublicKey]
    );

    return result.rows[0] ?? null;
  }

  async findBySlug(slug: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `select * from sites where slug = $1 and status = 'active' and widget_enabled = true`,
      [slug]
    );

    return result.rows[0] ?? null;
  }

  async create(input: SiteInput): Promise<SiteRecord> {
    const widgetPublicKey = input.widgetPublicKey ?? `site_${randomUUID()}`;
    const result = await this.database.query<SiteRecord>(
      `
      insert into sites (
        id,
        organization_id,
        name,
        slug,
        domain,
        widget_public_key,
        activity,
        business_config_id,
        language,
        status,
        widget_enabled
      )
      values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.name,
        input.slug,
        input.domain ?? null,
        widgetPublicKey,
        input.businessConfigId,
        input.language ?? 'fr',
        input.status ?? 'active',
        input.widgetEnabled ?? true
      ]
    );

    return requireRow(result.rows[0], 'Site was not created');
  }

  async update(id: string, input: SiteInput): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `
      update sites
      set
        organization_id = $1,
        name = $2,
        slug = $3,
        domain = $4,
        activity = $5,
        business_config_id = $5,
        language = $6,
        status = $7,
        widget_enabled = $8
      where id = $9
      returning *
      `,
      [
        input.organizationId,
        input.name,
        input.slug,
        input.domain ?? null,
        input.businessConfigId,
        input.language ?? 'fr',
        input.status ?? 'active',
        input.widgetEnabled ?? true,
        id
      ]
    );

    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: SiteStatus): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `update sites set status = $1, widget_enabled = ($1 = 'active') where id = $2 returning *`,
      [status, id]
    );

    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query(`delete from sites where id = $1`, [id]);

    return (result.rowCount ?? 0) > 0;
  }
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
