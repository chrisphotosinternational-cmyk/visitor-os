import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { ProspectStatus } from '../prospects/prospect-repository.js';

export type ContactChannel =
  | 'email'
  | 'phone'
  | 'whatsapp_manual'
  | 'instagram_manual'
  | 'x_manual'
  | 'mym_manual'
  | 'onlyfans_manual'
  | 'website_form'
  | 'other';

export const contactChannels: readonly ContactChannel[] = [
  'email',
  'phone',
  'whatsapp_manual',
  'instagram_manual',
  'x_manual',
  'mym_manual',
  'onlyfans_manual',
  'website_form',
  'other'
] as const;

export type ContactOutcome =
  | 'no_response'
  | 'positive'
  | 'negative'
  | 'interested'
  | 'not_now'
  | 'booked'
  | 'blacklist'
  | 'follow_up_needed';

export const contactOutcomes: readonly ContactOutcome[] = [
  'no_response',
  'positive',
  'negative',
  'interested',
  'not_now',
  'booked',
  'blacklist',
  'follow_up_needed'
] as const;

export type ContactHistoryRecord = {
  id: string;
  organization_id: string;
  prospect_id: string;
  user_id: string | null;
  contact_date: Date;
  channel: ContactChannel;
  message_used: string | null;
  response: string | null;
  outcome: ContactOutcome;
  next_action: string | null;
  follow_up_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  prospect_display_name?: string | null;
  prospect_city?: string | null;
  prospect_score?: number | null;
  prospect_status?: string | null;
};

export type ContactHistoryInput = {
  organizationId: string;
  prospectId: string;
  userId?: string;
  contactDate?: Date;
  channel: ContactChannel;
  messageUsed?: string;
  response?: string;
  outcome: ContactOutcome;
  nextAction?: string;
  followUpDate?: Date;
  notes?: string;
};

export type ContactHistoryFilters = {
  organizationId?: string;
  prospectId?: string;
  from?: Date;
  to?: Date;
  overdueOnly?: boolean;
  upcomingOnly?: boolean;
  city?: string;
  scoreLabel?: string;
  status?: string;
};

export class ContactHistoryRepository {
  constructor(private readonly database: Database) {}

  async listForProspect(
    prospectId: string,
    organizationId?: string
  ): Promise<ContactHistoryRecord[]> {
    const result = await this.database.query<ContactHistoryRecord>(
      `
      select *
      from contact_history
      where prospect_id = $1
        and ($2::uuid is null or organization_id = $2)
      order by contact_date desc, created_at desc
      `,
      [prospectId, organizationId ?? null]
    );

    return result.rows;
  }

  async create(input: ContactHistoryInput): Promise<ContactHistoryRecord> {
    const result = await this.database.query<ContactHistoryRecord>(
      `
      insert into contact_history (
        id,
        organization_id,
        prospect_id,
        user_id,
        contact_date,
        channel,
        message_used,
        response,
        outcome,
        next_action,
        follow_up_date,
        notes
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.prospectId,
        input.userId ?? null,
        input.contactDate ?? new Date(),
        input.channel,
        input.messageUsed ?? null,
        input.response ?? null,
        input.outcome,
        input.nextAction ?? null,
        input.followUpDate ?? null,
        input.notes ?? null
      ]
    );
    const row = requireRow(result.rows[0], 'Contact history was not created');
    await this.applyProspectStatus(row);

    return row;
  }

  async update(
    id: string,
    organizationId: string | undefined,
    input: ContactHistoryInput
  ): Promise<ContactHistoryRecord | null> {
    const result = await this.database.query<ContactHistoryRecord>(
      `
      update contact_history
      set
        contact_date = $1,
        channel = $2,
        message_used = $3,
        response = $4,
        outcome = $5,
        next_action = $6,
        follow_up_date = $7,
        notes = $8,
        updated_at = now()
      where id = $9
        and ($10::uuid is null or organization_id = $10)
      returning *
      `,
      [
        input.contactDate ?? new Date(),
        input.channel,
        input.messageUsed ?? null,
        input.response ?? null,
        input.outcome,
        input.nextAction ?? null,
        input.followUpDate ?? null,
        input.notes ?? null,
        id,
        organizationId ?? null
      ]
    );
    const row = result.rows[0] ?? null;
    if (row) await this.applyProspectStatus(row);

    return row;
  }

  async delete(id: string, organizationId?: string): Promise<boolean> {
    const result = await this.database.query(
      `
      delete from contact_history
      where id = $1
        and ($2::uuid is null or organization_id = $2)
      `,
      [id, organizationId ?? null]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async followUps(filters: ContactHistoryFilters = {}): Promise<ContactHistoryRecord[]> {
    const result = await this.database.query<ContactHistoryRecord>(
      `
      select
        ch.*,
        p.display_name as prospect_display_name,
        p.city as prospect_city,
        p.score as prospect_score,
        p.status as prospect_status
      from contact_history ch
      join prospects p on p.id = ch.prospect_id
      where
        ch.follow_up_date is not null
        and ($1::uuid is null or ch.organization_id = $1)
        and ($2::boolean = false or ch.follow_up_date < now())
        and ($3::boolean = false or ch.follow_up_date >= now())
        and ($4::text is null or p.city ilike $4)
        and ($5::text is null or p.score_label = $5)
        and ($6::text is null or p.status = $6)
      order by ch.follow_up_date asc, ch.created_at asc
      limit 300
      `,
      [
        filters.organizationId ?? null,
        filters.overdueOnly ?? false,
        filters.upcomingOnly ?? false,
        filters.city ? `%${filters.city}%` : null,
        filters.scoreLabel ?? null,
        filters.status ?? null
      ]
    );

    return result.rows;
  }

  async metrics(organizationId?: string): Promise<{
    dueToday: number;
    overdue: number;
    noResponse: number;
    interested: number;
    positiveRate: number;
    contactsThisWeek: number;
    neverContacted: number;
  }> {
    const result = await this.database.query<{
      due_today: string;
      overdue: string;
      no_response: string;
      interested: string;
      positive: string;
      total_contacts: string;
      contacts_this_week: string;
      never_contacted: string;
    }>(
      `
      select
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1) and ch.follow_up_date::date = current_date) as due_today,
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1) and ch.follow_up_date < now()) as overdue,
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1) and ch.outcome = 'no_response') as no_response,
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1) and ch.outcome = 'interested') as interested,
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1) and ch.outcome in ('positive', 'interested', 'booked')) as positive,
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1)) as total_contacts,
        (select count(*)::text from contact_history ch where ($1::uuid is null or ch.organization_id = $1) and ch.contact_date >= now() - interval '7 days') as contacts_this_week,
        (select count(*)::text from prospects p where ($1::uuid is null or p.organization_id = $1) and not exists (select 1 from contact_history ch where ch.prospect_id = p.id)) as never_contacted
      `,
      [organizationId ?? null]
    );
    const row = result.rows[0];
    const totalContacts = Number(row?.total_contacts ?? 0);
    const positive = Number(row?.positive ?? 0);

    return {
      dueToday: Number(row?.due_today ?? 0),
      overdue: Number(row?.overdue ?? 0),
      noResponse: Number(row?.no_response ?? 0),
      interested: Number(row?.interested ?? 0),
      positiveRate: totalContacts > 0 ? Math.round((positive / totalContacts) * 100) : 0,
      contactsThisWeek: Number(row?.contacts_this_week ?? 0),
      neverContacted: Number(row?.never_contacted ?? 0)
    };
  }

  async exportCsv(filters: ContactHistoryFilters = {}): Promise<string> {
    const rows = await this.followUps(filters);
    const headers = [
      'id',
      'organization_id',
      'prospect_id',
      'prospect_display_name',
      'contact_date',
      'channel',
      'outcome',
      'next_action',
      'follow_up_date',
      'notes'
    ];

    return [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => csvEscape(csvValue((row as unknown as Record<string, unknown>)[header])))
          .join(',')
      )
    ].join('\n');
  }

  private async applyProspectStatus(row: ContactHistoryRecord): Promise<void> {
    const status = statusForOutcome(row);
    await this.database.query(
      `
      update prospects
      set status = coalesce($1, status), updated_at = now()
      where id = $2 and organization_id = $3
      `,
      [status, row.prospect_id, row.organization_id]
    );
  }
}

function statusForOutcome(row: ContactHistoryRecord): ProspectStatus | null {
  if (row.follow_up_date) return 'follow_up';
  if (row.outcome === 'blacklist') return 'blacklist';
  if (row.outcome === 'booked') return 'signed_client';
  if (row.outcome === 'interested') return 'interested';
  if (row.outcome === 'positive') return 'interested';
  if (row.outcome === 'negative') return 'refused';
  if (row.outcome === 'follow_up_needed') return 'follow_up';
  return null;
}

function csvValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
