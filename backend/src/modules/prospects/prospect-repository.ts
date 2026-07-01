import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { calculateLeadScore } from '../crm/lead-scoring.js';
import { statusFromScore, type CrmFilters } from '../crm/crm-repository.js';

export type ProspectStatus =
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
  site_id: string;
  visitor_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: ProspectStatus;
  temperature: 'froide' | 'tiede' | 'chaude';
  score_current: number;
  source: string;
  created_at: Date;
  updated_at: Date;
  tags?: Array<{ id: string; label: string; slug: string; source: string }>;
};

export type ProspectDetail = ProspectRecord & {
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

function deriveDisplayName(question: string): string {
  const excerpt = question.trim().replace(/\s+/g, ' ').slice(0, 42);
  return excerpt ? `Prospect - ${excerpt}` : 'Prospect widget';
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
