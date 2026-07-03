import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { calculateLeadScore } from '../crm/lead-scoring.js';
import { statusFromScore, type CrmFilters } from '../crm/crm-repository.js';

export type ProspectStatus =
  | 'new'
  | 'to_qualify'
  | 'to_contact'
  | 'contacted'
  | 'interested'
  | 'refused'
  | 'follow_up'
  | 'potential_client'
  | 'signed_client'
  | 'blacklist'
  | 'Nouveau'
  | 'A qualifier'
  | 'Interesse'
  | 'A rappeler'
  | 'Reservation probable'
  | 'Devis demande'
  | 'Client'
  | 'Perdu'
  | 'Archive';

export const prospectStatuses: readonly ProspectStatus[] = [
  'new',
  'to_qualify',
  'to_contact',
  'contacted',
  'interested',
  'refused',
  'follow_up',
  'potential_client',
  'signed_client',
  'blacklist',
  'Nouveau',
  'A qualifier',
  'Interesse',
  'A rappeler',
  'Reservation probable',
  'Devis demande',
  'Client',
  'Perdu',
  'Archive'
] as const;

export type ProspectRecord = {
  id: string;
  organization_id: string;
  site_id: string | null;
  visitor_id: string | null;
  first_name: string | null;
  last_name: string | null;
  pseudo: string | null;
  company: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  twitter_x: string | null;
  mym: string | null;
  onlyfans: string | null;
  linktree: string | null;
  allmylinks: string | null;
  city: string | null;
  activity: string | null;
  description: string | null;
  source_url: string | null;
  status: ProspectStatus;
  temperature: 'froide' | 'tiede' | 'chaude';
  score_current: number;
  score: number;
  score_label: ProspectScoreLabel;
  notes: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
  tags?: Array<{ id: string; label: string; slug: string; source: string }>;
};

export type ProspectScoreLabel = 'very_high' | 'high' | 'medium' | 'low' | 'ignore';

export type ProspectPlatformFilter =
  | 'instagram'
  | 'twitter_x'
  | 'mym'
  | 'onlyfans'
  | 'website'
  | 'linktree'
  | 'allmylinks';

export type ProspectListFilters = {
  organizationId?: string;
  search?: string;
  status?: ProspectStatus;
  city?: string;
  scoreLabel?: ProspectScoreLabel;
  platform?: ProspectPlatformFilter;
  page?: number;
  pageSize?: number;
};

export type ProspectInput = {
  organizationId: string;
  firstName?: string;
  lastName?: string;
  pseudo?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  twitterX?: string;
  mym?: string;
  onlyfans?: string;
  linktree?: string;
  allmylinks?: string;
  city?: string;
  activity?: string;
  description?: string;
  sourceUrl?: string;
  status?: ProspectStatus;
  notes?: string;
};

export type ProspectListResult = {
  prospects: ProspectRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProspectMetrics = {
  total: number;
  toContact: number;
  interested: number;
  blacklist: number;
  highScore: number;
  withEmail: number;
  withPhone: number;
  premiumPlatforms: number;
  byCity: Array<{ city: string; count: number }>;
};

export type ImportCsvResult = {
  created: number;
  merged: number;
  rows: number;
  prospects: ProspectRecord[];
};

export type ProspectDetail = Omit<ProspectRecord, 'notes'> & {
  conversations: Array<{
    id: string;
    status: string;
    page_url: string | null;
    created_at: Date;
    messages: Array<{
      id: string;
      sender_type: string;
      content: string;
      created_at: Date;
    }>;
  }>;
  tags: Array<{ id: string; label: string; slug: string; source: string }>;
  notes: Array<{
    id: string;
    content: string;
    author_user_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>;
  followUps: Array<{
    id: string;
    due_at: Date;
    reason: string;
    status: string;
    completed_at: Date | null;
  }>;
  scoreHistory: Array<{
    id: string;
    score: number;
    previous_score: number | null;
    reasons: unknown;
    created_at: Date;
  }>;
};

export class ProspectRepository {
  constructor(private readonly database: Database) {}

  async createFromConversation(input: {
    organizationId: string;
    siteId: string;
    visitorId: string;
    question: string;
  }): Promise<ProspectRecord> {
    const scoring = calculateLeadScore({ messages: [input.question] });
    const status = statusFromScore(scoring.score);

    const result = await this.database.query<ProspectRecord>(
      `
      insert into prospects (
        id,
        organization_id,
        site_id,
        visitor_id,
        display_name,
        status,
        temperature,
        score_current,
        source
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, 'widget')
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.visitorId,
        deriveDisplayName(input.question),
        status,
        scoring.temperature,
        scoring.score
      ]
    );

    return requireRow(result.rows[0], 'Prospect was not created');
  }

  async list(filters: string | CrmFilters = {}): Promise<ProspectRecord[]> {
    const normalizedFilters: CrmFilters =
      typeof filters === 'string' ? { organizationId: filters } : filters;
    const result = await this.database.query<ProspectRecord>(
      `
      select p.*
      from prospects p
      where
        ($1::uuid is null or p.organization_id = $1)
        and ($2::uuid is null or p.site_id = $2)
        and ($3::text is null or p.status = $3)
        and ($4::integer is null or p.score_current >= $4)
        and ($5::integer is null or p.score_current <= $5)
        and ($6::text is null or exists (
          select 1
          from prospect_tags pt
          join crm_tags t on t.id = pt.tag_id
          where pt.prospect_id = p.id and t.slug = $6
        ))
        and ($7::text is null or (
          p.display_name ilike $7
          or p.email ilike $7
          or p.phone ilike $7
        ))
      order by p.updated_at desc, p.created_at desc
      limit 100
      `,
      [
        normalizedFilters.organizationId ?? null,
        normalizedFilters.siteId ?? null,
        normalizedFilters.status ?? null,
        normalizedFilters.scoreMin ?? null,
        normalizedFilters.scoreMax ?? null,
        normalizedFilters.tag ?? null,
        normalizedFilters.search ? `%${normalizedFilters.search}%` : null
      ]
    );

    return result.rows;
  }

  async listCore(filters: ProspectListFilters = {}): Promise<ProspectListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    const params = [
      filters.organizationId ?? null,
      filters.search ? `%${filters.search}%` : null,
      filters.status ?? null,
      filters.city ? `%${filters.city}%` : null,
      filters.scoreLabel ?? null,
      filters.platform ?? null
    ];
    const where = `
      where
        ($1::uuid is null or organization_id = $1)
        and ($2::text is null or (
          coalesce(first_name, '') ilike $2
          or coalesce(last_name, '') ilike $2
          or coalesce(display_name, '') ilike $2
          or coalesce(pseudo, '') ilike $2
          or coalesce(email, '') ilike $2
          or coalesce(phone, '') ilike $2
          or coalesce(city, '') ilike $2
        ))
        and ($3::text is null or status = $3)
        and ($4::text is null or coalesce(city, '') ilike $4)
        and ($5::text is null or score_label = $5)
        and (
          $6::text is null
          or ($6 = 'instagram' and instagram is not null and instagram <> '')
          or ($6 = 'twitter_x' and twitter_x is not null and twitter_x <> '')
          or ($6 = 'mym' and mym is not null and mym <> '')
          or ($6 = 'onlyfans' and onlyfans is not null and onlyfans <> '')
          or ($6 = 'website' and website is not null and website <> '')
          or ($6 = 'linktree' and linktree is not null and linktree <> '')
          or ($6 = 'allmylinks' and allmylinks is not null and allmylinks <> '')
        )
    `;
    const [countResult, prospectsResult] = await Promise.all([
      this.database.query<{ count: string }>(`select count(*)::text as count from prospects ${where}`, params),
      this.database.query<ProspectRecord>(
        `
        select *
        from prospects
        ${where}
        order by updated_at desc, created_at desc
        limit $7 offset $8
        `,
        [...params, pageSize, offset]
      )
    ]);

    return {
      prospects: prospectsResult.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
      page,
      pageSize
    };
  }

  async countCore(organizationId?: string): Promise<number> {
    const result = await this.database.query<{ count: string }>(
      `select count(*)::text as count from prospects where ($1::uuid is null or organization_id = $1)`,
      [organizationId ?? null]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async listAllCore(organizationId?: string): Promise<ProspectRecord[]> {
    const result = await this.database.query<ProspectRecord>(
      `
      select *
      from prospects
      where ($1::uuid is null or organization_id = $1)
      order by updated_at desc, created_at desc
      limit 1000
      `,
      [organizationId ?? null]
    );

    return result.rows;
  }

  async metrics(organizationId?: string): Promise<ProspectMetrics> {
    const [summary, cities] = await Promise.all([
      this.database.query<{
        total: string;
        to_contact: string;
        interested: string;
        blacklist: string;
        high_score: string;
        with_email: string;
        with_phone: string;
        premium_platforms: string;
      }>(
        `
        select
          count(*)::text as total,
          count(*) filter (where status in ('to_contact', 'follow_up'))::text as to_contact,
          count(*) filter (where status in ('interested', 'potential_client'))::text as interested,
          count(*) filter (where status = 'blacklist')::text as blacklist,
          count(*) filter (where score_label in ('high', 'very_high'))::text as high_score,
          count(*) filter (where email is not null and email <> '')::text as with_email,
          count(*) filter (where phone is not null and phone <> '')::text as with_phone,
          count(*) filter (where (mym is not null and mym <> '') or (onlyfans is not null and onlyfans <> ''))::text as premium_platforms
        from prospects
        where ($1::uuid is null or organization_id = $1)
        `,
        [organizationId ?? null]
      ),
      this.database.query<{ city: string; count: string }>(
        `
        select city, count(*)::text as count
        from prospects
        where ($1::uuid is null or organization_id = $1)
          and city is not null
          and city <> ''
        group by city
        order by count(*) desc, city asc
        limit 10
        `,
        [organizationId ?? null]
      )
    ]);
    const row = summary.rows[0];

    return {
      total: Number(row?.total ?? 0),
      toContact: Number(row?.to_contact ?? 0),
      interested: Number(row?.interested ?? 0),
      blacklist: Number(row?.blacklist ?? 0),
      highScore: Number(row?.high_score ?? 0),
      withEmail: Number(row?.with_email ?? 0),
      withPhone: Number(row?.with_phone ?? 0),
      premiumPlatforms: Number(row?.premium_platforms ?? 0),
      byCity: cities.rows.map((city) => ({ city: city.city, count: Number(city.count) }))
    };
  }

  async findCore(id: string, organizationId?: string): Promise<ProspectRecord | null> {
    const result = await this.database.query<ProspectRecord>(
      `select * from prospects where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    return result.rows[0] ?? null;
  }

  async createCore(input: ProspectInput): Promise<ProspectRecord> {
    const scored = scoreProspect(input);
    const result = await this.database.query<ProspectRecord>(
      `
      insert into prospects (
        id,
        organization_id,
        first_name,
        last_name,
        pseudo,
        company,
        display_name,
        email,
        phone,
        website,
        instagram,
        twitter_x,
        mym,
        onlyfans,
        linktree,
        allmylinks,
        city,
        activity,
        description,
        source_url,
        status,
        score_current,
        score,
        score_label,
        notes,
        source
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, 'admin'
      )
      returning *
      `,
      toInsertValues(randomUUID(), input, scored)
    );

    return requireRow(result.rows[0], 'Prospect was not created');
  }

  async updateCore(id: string, organizationId: string | undefined, input: ProspectInput): Promise<ProspectRecord | null> {
    const scored = scoreProspect(input);
    const result = await this.database.query<ProspectRecord>(
      `
      update prospects
      set
        organization_id = $1,
        first_name = $2,
        last_name = $3,
        pseudo = $4,
        company = $5,
        display_name = $6,
        email = $7,
        phone = $8,
        website = $9,
        instagram = $10,
        twitter_x = $11,
        mym = $12,
        onlyfans = $13,
        linktree = $14,
        allmylinks = $15,
        city = $16,
        activity = $17,
        description = $18,
        source_url = $19,
        status = $20,
        score_current = $21,
        score = $22,
        score_label = $23,
        notes = $24,
        updated_at = now()
      where id = $25 and ($26::uuid is null or organization_id = $26)
      returning *
      `,
      [...toUpdateValues(input, scored), id, organizationId ?? null]
    );

    return result.rows[0] ?? null;
  }

  async deleteCore(id: string, organizationId?: string): Promise<boolean> {
    const result = await this.database.query(
      `delete from prospects where id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async importCsv(organizationId: string, csv: string): Promise<ImportCsvResult> {
    const rows = parseCsv(csv).map((row) => normalizeCsvRow(organizationId, row));
    const prospects: ProspectRecord[] = [];
    let created = 0;
    let merged = 0;

    for (const row of rows) {
      const duplicate = await this.findDuplicate(row);
      if (duplicate) {
        const mergedInput = mergeProspectInputs(duplicate, row);
        const updated = await this.updateCore(duplicate.id, duplicate.organization_id, mergedInput);
        if (updated) prospects.push(updated);
        merged += 1;
      } else {
        prospects.push(await this.createCore(row));
        created += 1;
      }
    }

    return { created, merged, rows: rows.length, prospects };
  }

  async exportCsv(filters: ProspectListFilters = {}): Promise<string> {
    const result = await this.listCore({ ...filters, page: 1, pageSize: 1000 });
    return toProspectsCsv(result.prospects);
  }

  async findDuplicate(input: ProspectInput): Promise<ProspectRecord | null> {
    const result = await this.database.query<ProspectRecord>(
      `
      select *
      from prospects
      where organization_id = $1
        and (
          ($2::text is not null and lower(email) = lower($2))
          or ($3::text is not null and phone = $3)
          or ($4::text is not null and source_url = $4)
          or ($5::text is not null and $6::text is not null and lower(pseudo) = lower($5) and lower(city) = lower($6))
        )
      order by updated_at desc
      limit 1
      `,
      [
        input.organizationId,
        emptyToNull(input.email),
        emptyToNull(input.phone),
        emptyToNull(input.sourceUrl),
        emptyToNull(input.pseudo),
        emptyToNull(input.city)
      ]
    );

    return result.rows[0] ?? null;
  }

  async findDetail(id: string, organizationId?: string): Promise<ProspectDetail | null> {
    const prospectResult = organizationId
      ? await this.database.query<ProspectRecord>(
          `select * from prospects where id = $1 and organization_id = $2`,
          [id, organizationId]
        )
      : await this.database.query<ProspectRecord>(`select * from prospects where id = $1`, [id]);
    const prospect = prospectResult.rows[0];

    if (!prospect) {
      return null;
    }

    const conversationsResult = await this.database.query<{
      id: string;
      status: string;
      page_url: string | null;
      created_at: Date;
    }>(
      `select id, status, page_url, created_at from conversations where prospect_id = $1 and ($2::uuid is null or organization_id = $2)`,
      [id, organizationId ?? null]
    );

    const conversations = await Promise.all(
      conversationsResult.rows.map(async (conversation) => {
        const messagesResult = await this.database.query<{
          id: string;
          sender_type: string;
          content: string;
          response_source: string | null;
          response_confidence: number | null;
          should_escalate: boolean | null;
          processing_time_ms: number | null;
          matched_item_id: string | null;
          decision_reason: string | null;
          created_at: Date;
        }>(
          `select
             id,
             sender_type,
             content,
             response_source,
             response_confidence,
             should_escalate,
             processing_time_ms,
             matched_item_id,
             decision_reason,
             created_at
           from messages
           where conversation_id = $1
           order by created_at asc`,
          [conversation.id]
        );

        return {
          ...conversation,
          messages: messagesResult.rows
        };
      })
    );

    const tagsResult = await this.database.query<{
      id: string;
      label: string;
      slug: string;
      source: string;
    }>(
      `
      select t.id, t.label, t.slug, pt.source
      from prospect_tags pt
      join crm_tags t on t.id = pt.tag_id
      where pt.prospect_id = $1
      order by t.label asc
      `,
      [id]
    );
    const notesResult = await this.database.query<{
      id: string;
      content: string;
      author_user_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      select id, content, author_user_id, created_at, updated_at
      from internal_notes
      where prospect_id = $1 and ($2::uuid is null or organization_id = $2)
      order by created_at desc
      `,
      [id, organizationId ?? null]
    );
    const followUpsResult = await this.database.query<{
      id: string;
      due_at: Date;
      reason: string;
      status: string;
      completed_at: Date | null;
    }>(
      `
      select id, due_at, reason, status, completed_at
      from follow_ups
      where prospect_id = $1 and ($2::uuid is null or organization_id = $2)
      order by due_at asc
      `,
      [id, organizationId ?? null]
    );
    const scoreHistoryResult = await this.database.query<{
      id: string;
      score: number;
      previous_score: number | null;
      reasons: unknown;
      created_at: Date;
    }>(
      `
      select id, score, previous_score, reasons, created_at
      from lead_score_history
      where prospect_id = $1 and ($2::uuid is null or organization_id = $2)
      order by created_at desc
      `,
      [id, organizationId ?? null]
    );

    return {
      ...prospect,
      conversations,
      tags: tagsResult.rows,
      notes: notesResult.rows,
      followUps: followUpsResult.rows,
      scoreHistory: scoreHistoryResult.rows
    };
  }

  async updateStatus(id: string, status: ProspectStatus): Promise<ProspectRecord | null> {
    const result = await this.database.query<ProspectRecord>(
      `update prospects set status = $1, updated_at = now() where id = $2 returning *`,
      [status, id]
    );

    return result.rows[0] ?? null;
  }
}

export function scoreProspect(input: ProspectInput): { score: number; label: ProspectScoreLabel } {
  const hasContact = Boolean(input.email || input.phone || input.instagram || input.twitterX || input.website);
  let score = 0;
  if (input.city) score += 10;
  if (input.email) score += 15;
  if (input.phone) score += 15;
  if (input.instagram || input.twitterX) score += 10;
  if (input.mym || input.onlyfans) score += 20;
  if (input.website || input.linktree || input.allmylinks) score += 10;
  if (input.description && input.description.trim().length >= 20) score += 10;
  if (!hasContact) score -= 25;
  score = Math.max(0, Math.min(100, score));

  return { score, label: scoreLabel(score) };
}

export function scoreLabel(score: number): ProspectScoreLabel {
  if (score >= 80) return 'very_high';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'ignore';
}

function deriveDisplayName(question: string): string {
  const excerpt = question.trim().replace(/\s+/g, ' ').slice(0, 42);
  return excerpt ? `Prospect - ${excerpt}` : 'Prospect widget';
}

function displayName(input: ProspectInput): string {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  return fullName || input.pseudo || input.company || input.email || input.phone || 'Prospect';
}

function toInsertValues(
  id: string,
  input: ProspectInput,
  scored: { score: number; label: ProspectScoreLabel }
): unknown[] {
  return [
    id,
    input.organizationId,
    emptyToNull(input.firstName),
    emptyToNull(input.lastName),
    emptyToNull(input.pseudo),
    emptyToNull(input.company),
    displayName(input),
    emptyToNull(input.email)?.toLowerCase() ?? null,
    emptyToNull(input.phone),
    emptyToNull(input.website),
    emptyToNull(input.instagram),
    emptyToNull(input.twitterX),
    emptyToNull(input.mym),
    emptyToNull(input.onlyfans),
    emptyToNull(input.linktree),
    emptyToNull(input.allmylinks),
    emptyToNull(input.city),
    emptyToNull(input.activity),
    emptyToNull(input.description),
    emptyToNull(input.sourceUrl),
    input.status ?? 'new',
    scored.score,
    scored.score,
    scored.label,
    emptyToNull(input.notes)
  ];
}

function toUpdateValues(
  input: ProspectInput,
  scored: { score: number; label: ProspectScoreLabel }
): unknown[] {
  return [
    input.organizationId,
    emptyToNull(input.firstName),
    emptyToNull(input.lastName),
    emptyToNull(input.pseudo),
    emptyToNull(input.company),
    displayName(input),
    emptyToNull(input.email)?.toLowerCase() ?? null,
    emptyToNull(input.phone),
    emptyToNull(input.website),
    emptyToNull(input.instagram),
    emptyToNull(input.twitterX),
    emptyToNull(input.mym),
    emptyToNull(input.onlyfans),
    emptyToNull(input.linktree),
    emptyToNull(input.allmylinks),
    emptyToNull(input.city),
    emptyToNull(input.activity),
    emptyToNull(input.description),
    emptyToNull(input.sourceUrl),
    input.status ?? 'new',
    scored.score,
    scored.score,
    scored.label,
    emptyToNull(input.notes)
  ];
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const rows = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
  const headers = rows.shift()?.map(normalizeHeader) ?? [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? '']))
  );
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeCsvRow(organizationId: string, row: Record<string, string>): ProspectInput {
  const status = normalizeStatus(first(row, 'status', 'statut'));

  return {
    organizationId,
    ...optionalField('firstName', first(row, 'first_name', 'firstname', 'prenom')),
    ...optionalField('lastName', first(row, 'last_name', 'lastname', 'nom')),
    ...optionalField('pseudo', first(row, 'pseudo', 'username')),
    ...optionalField('company', first(row, 'company', 'societe')),
    ...optionalField('email', first(row, 'email', 'mail')),
    ...optionalField('phone', first(row, 'phone', 'telephone', 'tel')),
    ...optionalField('website', first(row, 'website', 'site', 'site_web', 'portfolio')),
    ...optionalField('instagram', first(row, 'instagram')),
    ...optionalField('twitterX', first(row, 'twitter_x', 'twitter', 'x')),
    ...optionalField('mym', first(row, 'mym')),
    ...optionalField('onlyfans', first(row, 'onlyfans')),
    ...optionalField('linktree', first(row, 'linktree')),
    ...optionalField('allmylinks', first(row, 'allmylinks', 'all_my_links')),
    ...optionalField('city', first(row, 'city', 'ville')),
    ...optionalField('activity', first(row, 'activity', 'activite')),
    ...optionalField('description', first(row, 'description', 'bio')),
    ...optionalField('sourceUrl', first(row, 'source_url', 'source', 'url')),
    ...optionalField('notes', first(row, 'notes')),
    ...(status ? { status } : {})
  };
}

function first(row: Record<string, string>, ...keys: string[]): string | undefined {
  return keys.map((key) => row[key]).find((value) => Boolean(value?.trim()));
}

function normalizeStatus(value: string | undefined): ProspectStatus | undefined {
  if (!value) return undefined;
  return prospectStatuses.includes(value as ProspectStatus) ? (value as ProspectStatus) : 'new';
}

function mergeProspectInputs(existing: ProspectRecord, incoming: ProspectInput): ProspectInput {
  return {
    organizationId: existing.organization_id,
    ...optionalField('firstName', incoming.firstName ?? existing.first_name ?? undefined),
    ...optionalField('lastName', incoming.lastName ?? existing.last_name ?? undefined),
    ...optionalField('pseudo', incoming.pseudo ?? existing.pseudo ?? undefined),
    ...optionalField('company', incoming.company ?? existing.company ?? undefined),
    ...optionalField('email', incoming.email ?? existing.email ?? undefined),
    ...optionalField('phone', incoming.phone ?? existing.phone ?? undefined),
    ...optionalField('website', incoming.website ?? existing.website ?? undefined),
    ...optionalField('instagram', incoming.instagram ?? existing.instagram ?? undefined),
    ...optionalField('twitterX', incoming.twitterX ?? existing.twitter_x ?? undefined),
    ...optionalField('mym', incoming.mym ?? existing.mym ?? undefined),
    ...optionalField('onlyfans', incoming.onlyfans ?? existing.onlyfans ?? undefined),
    ...optionalField('linktree', incoming.linktree ?? existing.linktree ?? undefined),
    ...optionalField('allmylinks', incoming.allmylinks ?? existing.allmylinks ?? undefined),
    ...optionalField('city', incoming.city ?? existing.city ?? undefined),
    ...optionalField('activity', incoming.activity ?? existing.activity ?? undefined),
    ...optionalField('description', moreComplete(incoming.description, existing.description)),
    ...optionalField('sourceUrl', incoming.sourceUrl ?? existing.source_url ?? undefined),
    status: incoming.status ?? existing.status,
    ...optionalField('notes', moreComplete(incoming.notes, existing.notes))
  };
}

function optionalField<K extends keyof ProspectInput>(
  key: K,
  value: ProspectInput[K] | undefined
): Partial<Pick<ProspectInput, K>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Pick<ProspectInput, K>>);
}

function moreComplete(incoming: string | undefined, existing: string | null): string | undefined {
  if (!incoming) return existing ?? undefined;
  if (!existing) return incoming;
  return incoming.length > existing.length ? incoming : existing;
}

function toProspectsCsv(prospects: ProspectRecord[]): string {
  const headers = [
    'id',
    'organization_id',
    'first_name',
    'last_name',
    'pseudo',
    'company',
    'email',
    'phone',
    'website',
    'instagram',
    'twitter_x',
    'mym',
    'onlyfans',
    'linktree',
    'allmylinks',
    'city',
    'activity',
    'status',
    'score',
    'score_label',
    'source_url',
    'notes'
  ];
  const lines = prospects.map((prospect) =>
    headers.map((header) => csvEscape(csvValue((prospect as unknown as Record<string, unknown>)[header]))).join(',')
  );

  return [headers.join(','), ...lines].join('\n');
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
  if (!row) {
    throw new Error(message);
  }

  return row;
}
