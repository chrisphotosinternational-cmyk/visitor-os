import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export type OrganizationStatus = 'active' | 'inactive' | 'suspended' | 'deleted';

export const organizationStatuses: readonly OrganizationStatus[] = [
  'active',
  'inactive',
  'suspended',
  'deleted'
] as const;

export type OrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  language: string;
  timezone: string;
  currency: string;
  status: OrganizationStatus;
  subscription_status: string | null;
  ai_quota: number | null;
  conversation_quota: number | null;
  storage_quota_mb: number | null;
  plan: string | null;
  created_at: Date;
};

export type OrganizationInput = {
  name: string;
  slug: string;
  description?: string;
  email?: string;
  phone?: string;
  country?: string;
  language?: string;
  timezone?: string;
  currency?: string;
  status?: OrganizationStatus;
  plan?: string;
};

export class OrganizationRepository {
  constructor(private readonly database: Database) {}

  async list(search?: string): Promise<OrganizationRecord[]> {
    const searchTerm = `%${search ?? ''}%`;
    const result = await this.database.query<OrganizationRecord>(
      `
      select * from organizations
      where status <> 'deleted'
        and ($1 = '%%' or name ilike $1 or slug ilike $1 or coalesce(email, '') ilike $1)
      order by created_at desc, name asc
      limit 100
      `,
      [searchTerm]
    );

    return result.rows;
  }

  async count(): Promise<number> {
    const result = await this.database.query<{ count: string }>(
      `select count(*)::text as count from organizations where status <> 'deleted'`
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async find(id: string): Promise<OrganizationRecord | null> {
    const result = await this.database.query<OrganizationRecord>(
      `select * from organizations where id = $1`,
      [id]
    );

    return result.rows[0] ?? null;
  }

  async create(input: OrganizationInput): Promise<OrganizationRecord> {
    const result = await this.database.query<OrganizationRecord>(
      `
      insert into organizations (
        id,
        name,
        slug,
        description,
        email,
        phone,
        country,
        language,
        timezone,
        currency,
        status,
        plan
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *
      `,
      [
        randomUUID(),
        input.name,
        input.slug,
        input.description ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.country ?? 'FR',
        input.language ?? 'fr',
        input.timezone ?? 'Europe/Paris',
        input.currency ?? 'EUR',
        input.status ?? 'active',
        input.plan ?? null
      ]
    );

    return requireRow(result.rows[0], 'Organization was not created');
  }

  async update(id: string, input: OrganizationInput): Promise<OrganizationRecord | null> {
    const result = await this.database.query<OrganizationRecord>(
      `
      update organizations
      set
        name = $1,
        slug = $2,
        description = $3,
        email = $4,
        phone = $5,
        country = $6,
        language = $7,
        timezone = $8,
        currency = $9,
        status = $10,
        plan = $11
      where id = $12
      returning *
      `,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.country ?? 'FR',
        input.language ?? 'fr',
        input.timezone ?? 'Europe/Paris',
        input.currency ?? 'EUR',
        input.status ?? 'active',
        input.plan ?? null,
        id
      ]
    );

    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: OrganizationStatus): Promise<OrganizationRecord | null> {
    const result = await this.database.query<OrganizationRecord>(
      `update organizations set status = $1 where id = $2 returning *`,
      [status, id]
    );

    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.database.query(
      `update organizations set status = 'deleted' where id = $1 and status <> 'deleted'`,
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
