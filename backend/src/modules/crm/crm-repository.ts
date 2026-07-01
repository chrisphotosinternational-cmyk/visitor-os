import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { crmTagDefinitions, detectAutomaticTags } from './tags.js';
import { calculateLeadScore, type LeadScoreReason } from './lead-scoring.js';
import type { ProspectStatus } from '../prospects/prospect-repository.js';

export type CrmFilters = {
  organizationId?: string | undefined;
  siteId?: string | undefined;
  status?: string | undefined;
  tag?: string | undefined;
  search?: string | undefined;
  scoreMin?: number | undefined;
  scoreMax?: number | undefined;
  periodFrom?: string | undefined;
  periodTo?: string | undefined;
  followUp?: 'today' | 'overdue' | 'pending' | 'completed' | undefined;
};

export type CrmTagRecord = {
  id: string;
  organization_id: string;
  site_id: string | null;
  label: string;
  slug: string;
  color: string | null;
  created_at: Date;
};

export type CrmNoteRecord = {
  id: string;
  organization_id: string;
  prospect_id: string | null;
  conversation_id: string | null;
  author_user_id: string | null;
  content: string;
  created_at: Date;
  updated_at: Date;
};

export type FollowUpRecord = {
  id: string;
  organization_id: string;
  prospect_id: string;
  conversation_id: string | null;
  author_user_id: string | null;
  due_at: Date;
  reason: string;
  status: 'pending' | 'completed' | 'cancelled';
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ScoreHistoryRecord = {
  id: string;
  organization_id: string;
  prospect_id: string;
  score: number;
  previous_score: number | null;
  reasons: LeadScoreReason[];
  created_at: Date;
};

export class CrmRepository {
  constructor(private readonly database: Database) {}

  async ensureDefaultTags(organizationId: string): Promise<CrmTagRecord[]> {
    const tags = await Promise.all(
      crmTagDefinitions.map(async (definition) => {
        const result = await this.database.query<CrmTagRecord>(
          `
          insert into crm_tags (id, organization_id, label, slug)
          values ($1, $2, $3, $4)
          on conflict (organization_id, slug)
          do update set label = excluded.label
          returning *
          `,
          [randomUUID(), organizationId, definition.label, definition.slug]
        );

        return result.rows[0];
      })
    );

    return tags.filter((tag): tag is CrmTagRecord => Boolean(tag));
  }

  async listTags(organizationId: string): Promise<CrmTagRecord[]> {
    await this.ensureDefaultTags(organizationId);
    const result = await this.database.query<CrmTagRecord>(
      `select * from crm_tags where organization_id = $1 order by label asc`,
      [organizationId]
    );

    return result.rows;
  }

  async applyAutomaticTags(input: {
    organizationId: string;
    prospectId: string;
    conversationId?: string;
    messages: string[];
  }): Promise<CrmTagRecord[]> {
    const available = await this.listTags(input.organizationId);
    const detected = detectAutomaticTags(input.messages);
    const applied: CrmTagRecord[] = [];

    for (const definition of detected) {
      const tag = available.find((item) => item.slug === definition.slug);
      if (!tag) continue;

      await this.addProspectTag(input.prospectId, tag.id, 'automatic');
      if (input.conversationId) {
        await this.addConversationTag(input.conversationId, tag.id, 'automatic');
      }
      applied.push(tag);
    }

    return applied;
  }

  async addProspectTag(
    prospectId: string,
    tagId: string,
    source: 'automatic' | 'manual'
  ): Promise<void> {
    await this.database.query(
      `
      insert into prospect_tags (prospect_id, tag_id, source)
      values ($1, $2, $3)
      on conflict (prospect_id, tag_id) do nothing
      `,
      [prospectId, tagId, source]
    );
  }

  async removeProspectTag(prospectId: string, tagId: string): Promise<void> {
    await this.database.query(`delete from prospect_tags where prospect_id = $1 and tag_id = $2`, [
      prospectId,
      tagId
    ]);
  }

  async addConversationTag(
    conversationId: string,
    tagId: string,
    source: 'automatic' | 'manual'
  ): Promise<void> {
    await this.database.query(
      `
      insert into conversation_tags (conversation_id, tag_id, source)
      values ($1, $2, $3)
      on conflict (conversation_id, tag_id) do nothing
      `,
      [conversationId, tagId, source]
    );
  }

  async recalculateScore(input: {
    prospectId: string;
    organizationId: string;
    previousScore?: number | null;
  }): Promise<{ score: number; reasons: LeadScoreReason[] }> {
    const detail = await this.loadProspectScoringContext(input.prospectId, input.organizationId);
    const result = calculateLeadScore(detail);

    await this.database.query(
      `
      update prospects
      set score_current = $1,
          temperature = $2,
          updated_at = now()
      where id = $3 and organization_id = $4
      `,
      [result.score, result.temperature, input.prospectId, input.organizationId]
    );
    await this.insertScoreHistory({
      organizationId: input.organizationId,
      prospectId: input.prospectId,
      score: result.score,
      previousScore: input.previousScore ?? detail.previousScore,
      reasons: result.reasons
    });

    return { score: result.score, reasons: result.reasons };
  }

  async insertScoreHistory(input: {
    organizationId: string;
    prospectId: string;
    score: number;
    previousScore?: number | null;
    reasons: LeadScoreReason[];
  }): Promise<void> {
    await this.database.query(
      `
      insert into lead_score_history (
        id,
        organization_id,
        prospect_id,
        score,
        previous_score,
        reasons
      )
      values ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.prospectId,
        input.score,
        input.previousScore ?? null,
        JSON.stringify(input.reasons)
      ]
    );
  }

  async listScoreHistory(
    prospectId: string,
    organizationId: string
  ): Promise<ScoreHistoryRecord[]> {
    const result = await this.database.query<ScoreHistoryRecord>(
      `
      select *
      from lead_score_history
      where prospect_id = $1 and organization_id = $2
      order by created_at desc
      `,
      [prospectId, organizationId]
    );

    return result.rows;
  }

  async createNote(input: {
    organizationId: string;
    prospectId?: string;
    conversationId?: string;
    authorUserId: string;
    content: string;
  }): Promise<CrmNoteRecord> {
    const result = await this.database.query<CrmNoteRecord>(
      `
      insert into internal_notes (
        id,
        organization_id,
        prospect_id,
        conversation_id,
        author_user_id,
        content
      )
      values ($1, $2, $3, $4, $5, $6)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.prospectId ?? null,
        input.conversationId ?? null,
        input.authorUserId,
        input.content
      ]
    );

    return requireRow(result.rows[0], 'Note was not created');
  }

  async updateNote(
    id: string,
    organizationId: string,
    content: string
  ): Promise<CrmNoteRecord | null> {
    const result = await this.database.query<CrmNoteRecord>(
      `
      update internal_notes
      set content = $1, updated_at = now()
      where id = $2 and organization_id = $3
      returning *
      `,
      [content, id, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async deleteNote(id: string, organizationId: string): Promise<boolean> {
    const result = await this.database.query(
      `delete from internal_notes where id = $1 and organization_id = $2`,
      [id, organizationId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async createFollowUp(input: {
    organizationId: string;
    prospectId: string;
    conversationId?: string;
    authorUserId: string;
    dueAt: string;
    reason: string;
  }): Promise<FollowUpRecord> {
    const result = await this.database.query<FollowUpRecord>(
      `
      insert into follow_ups (
        id,
        organization_id,
        prospect_id,
        conversation_id,
        author_user_id,
        due_at,
        reason
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.prospectId,
        input.conversationId ?? null,
        input.authorUserId,
        input.dueAt,
        input.reason
      ]
    );

    return requireRow(result.rows[0], 'Follow-up was not created');
  }

  async completeFollowUp(id: string, organizationId: string): Promise<FollowUpRecord | null> {
    const result = await this.database.query<FollowUpRecord>(
      `
      update follow_ups
      set status = 'completed',
          completed_at = now(),
          updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [id, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async listFollowUps(
    organizationId: string,
    mode: 'today' | 'overdue' | 'pending' | 'completed' = 'pending'
  ): Promise<FollowUpRecord[]> {
    const condition =
      mode === 'today'
        ? `status = 'pending' and due_at::date = current_date`
        : mode === 'overdue'
          ? `status = 'pending' and due_at < now()`
          : `status = $2`;
    const values =
      mode === 'today' || mode === 'overdue' ? [organizationId] : [organizationId, mode];
    const result = await this.database.query<FollowUpRecord>(
      `
      select *
      from follow_ups
      where organization_id = $1 and ${condition}
      order by due_at asc
      limit 100
      `,
      values
    );

    return result.rows;
  }

  async exportProspects(
    filters: CrmFilters
  ): Promise<Array<Record<string, string | number | null>>> {
    const result = await this.database.query<Record<string, string | number | null>>(
      `
      select
        p.created_at::text as "Date",
        o.name as "Organisation",
        s.name as "Site",
        p.first_name as "Prenom",
        p.last_name as "Nom",
        p.email as "Email",
        p.phone as "Telephone",
        p.status as "Statut",
        p.score_current as "Score",
        coalesce(string_agg(distinct t.label, ', '), '') as "Tags",
        (
          select m.content
          from conversations c
          join messages m on m.conversation_id = c.id
          where c.prospect_id = p.id and m.sender_type = 'visitor'
          order by m.created_at desc
          limit 1
        ) as "Derniere question",
        (
          select m.content
          from conversations c
          join messages m on m.conversation_id = c.id
          where c.prospect_id = p.id and m.sender_type = 'assistant'
          order by m.created_at desc
          limit 1
        ) as "Derniere reponse",
        coalesce(string_agg(distinct n.content, ' | '), '') as "Notes",
        (
          select f.due_at::text || ' - ' || f.reason
          from follow_ups f
          where f.prospect_id = p.id and f.status = 'pending'
          order by f.due_at asc
          limit 1
        ) as "Relance",
        p.source as "Source"
      from prospects p
      join organizations o on o.id = p.organization_id
      join sites s on s.id = p.site_id
      left join prospect_tags pt on pt.prospect_id = p.id
      left join crm_tags t on t.id = pt.tag_id
      left join internal_notes n on n.prospect_id = p.id
      where
        ($1::uuid is null or p.organization_id = $1)
        and ($2::uuid is null or p.site_id = $2)
        and ($3::text is null or p.status = $3)
        and ($4::integer is null or p.score_current >= $4)
        and ($5::integer is null or p.score_current <= $5)
        and ($6::text is null or exists (
          select 1
          from prospect_tags ept
          join crm_tags et on et.id = ept.tag_id
          where ept.prospect_id = p.id and et.slug = $6
        ))
        and ($7::timestamptz is null or p.created_at >= $7)
        and ($8::timestamptz is null or p.created_at <= $8)
      group by p.id, o.name, s.name
      order by p.updated_at desc
      limit 1000
      `,
      [
        filters.organizationId ?? null,
        filters.siteId ?? null,
        filters.status ?? null,
        filters.scoreMin ?? null,
        filters.scoreMax ?? null,
        filters.tag ?? null,
        filters.periodFrom ?? null,
        filters.periodTo ?? null
      ]
    );

    return result.rows;
  }

  private async loadProspectScoringContext(
    prospectId: string,
    organizationId: string
  ): Promise<{
    email: string | null;
    phone: string | null;
    messages: string[];
    previousConversationCount: number;
    previousScore: number | null;
  }> {
    const prospectResult = await this.database.query<{
      email: string | null;
      phone: string | null;
      score_current: number | null;
    }>(`select email, phone, score_current from prospects where id = $1 and organization_id = $2`, [
      prospectId,
      organizationId
    ]);
    const prospect = requireRow(prospectResult.rows[0], 'Prospect was not found');
    const messagesResult = await this.database.query<{ content: string }>(
      `
      select m.content
      from messages m
      join conversations c on c.id = m.conversation_id
      where c.prospect_id = $1 and c.organization_id = $2
      order by m.created_at asc
      `,
      [prospectId, organizationId]
    );
    const conversationsResult = await this.database.query<{ count: string }>(
      `select count(*)::text as count from conversations where prospect_id = $1 and organization_id = $2`,
      [prospectId, organizationId]
    );

    return {
      email: prospect.email,
      phone: prospect.phone,
      messages: messagesResult.rows.map((message) => message.content),
      previousConversationCount: Math.max(0, Number(conversationsResult.rows[0]?.count ?? 1) - 1),
      previousScore: prospect.score_current
    };
  }
}

export function statusFromScore(score: number): ProspectStatus {
  if (score >= 82) return 'Reservation probable';
  if (score >= 70) return 'Interesse';
  if (score >= 55) return 'A qualifier';

  return 'Nouveau';
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
