import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { AppError } from '../../core/errors/app-error.js';

export const knowledgeItemStatuses = ['draft', 'active', 'archived', 'needs_review'] as const;
export const flowStepTypes = [
  'question',
  'answer',
  'condition',
  'action',
  'lead_capture',
  'end'
] as const;
export const flowActionTypes = [
  'show_answer',
  'ask_question',
  'capture_lead',
  'suggest_cta',
  'convert_to_prospect',
  'end_conversation'
] as const;
export const suggestionStatuses = ['pending', 'accepted', 'rejected'] as const;

export type KnowledgeAnswer = {
  reply: string;
  source: 'knowledge_engine' | 'site_qa' | 'fallback';
  confidence: number;
  matchedItemId: string | undefined;
  detectedIntent: string | undefined;
  reason: string;
};

export type KnowledgeIntentInput = {
  name: string;
  slug?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  examples?: string[] | undefined;
  synonyms?: string[] | undefined;
  priority?: number | undefined;
  isActive?: boolean | undefined;
};

export type KnowledgeItemInput = {
  intentId?: string | null | undefined;
  title: string;
  mainQuestion: string;
  alternativeQuestions?: string[] | undefined;
  shortAnswer: string;
  detailedAnswer?: string | undefined;
  commercialAnswer?: string | undefined;
  reassuranceAnswer?: string | undefined;
  links?: string[] | undefined;
  ctaLabel?: string | undefined;
  ctaUrl?: string | undefined;
  conditions?: string | undefined;
  tags?: string[] | undefined;
  priority?: number | undefined;
  status?: (typeof knowledgeItemStatuses)[number] | undefined;
  userId?: string | null | undefined;
};

export type FlowInput = {
  name: string;
  description?: string | undefined;
  triggerIntentId?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type FlowStepInput = {
  flowId: string;
  stepOrder: number;
  stepType: (typeof flowStepTypes)[number];
  content: string;
  conditions?: string | undefined;
  nextStepId?: string | null | undefined;
  actionType?: (typeof flowActionTypes)[number] | null | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type PersonalityInput = {
  tone: string;
  style?: string | undefined;
  answerLength: 'short' | 'medium' | 'detailed';
  formality: 'tutoiement' | 'vouvoiement';
  emojiLevel: 'none' | 'low' | 'medium';
  commercialIntensity: number;
  reassuranceLevel: number;
};

export type GoalInput = {
  goalType: string;
  description: string;
  priority?: number | undefined;
  successAction?: string | undefined;
  isActive?: boolean | undefined;
};

type LoosePartial<T> = {
  [K in keyof T]?: T[K] | undefined;
};

export class KnowledgeEngineService {
  constructor(private readonly database: Database) {}

  async listChatbots(organizationId?: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        s.id,
        s.organization_id,
        s.name,
        s.domain,
        s.status,
        s.widget_enabled,
        count(distinct c.id)::int as conversations,
        count(distinct k.id)::int as knowledge_items,
        count(distinct i.id)::int as intents,
        count(distinct u.id) filter (where u.action_status = 'pending' or u.status = 'pending')::int as unanswered,
        count(distinct sug.id) filter (where sug.status = 'pending')::int as suggestions,
        count(distinct p.id)::int as leads_captured
      from sites s
      left join conversations c on c.site_id = s.id
      left join knowledge_items k on k.site_id = s.id and k.status = 'active'
      left join chatbot_intents i on i.site_id = s.id and i.is_active = true
      left join chatbot_unanswered_questions u on u.site_id = s.id
      left join knowledge_suggestions sug on sug.site_id = s.id
      left join prospects p on p.id = c.prospect_id
      where ($1::uuid is null or s.organization_id = $1)
      group by s.id
      order by s.name asc
      `,
      [organizationId ?? null]
    );

    return result.rows;
  }

  async getOverview(siteId: string, organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        s.id,
        s.organization_id,
        s.name,
        s.domain,
        s.status,
        s.widget_enabled,
        count(distinct c.id)::int as conversations,
        count(distinct k.id)::int as knowledge_items,
        count(distinct i.id)::int as intents,
        count(distinct u.id) filter (where u.action_status = 'pending' or u.status = 'pending')::int as unanswered,
        count(distinct sug.id) filter (where sug.status = 'pending')::int as suggestions
      from sites s
      left join conversations c on c.site_id = s.id
      left join knowledge_items k on k.site_id = s.id
      left join chatbot_intents i on i.site_id = s.id
      left join chatbot_unanswered_questions u on u.site_id = s.id
      left join knowledge_suggestions sug on sug.site_id = s.id
      where s.id = $1 and s.organization_id = $2
      group by s.id
      `,
      [siteId, organizationId]
    );

    return requireRow(result.rows[0], 'Chatbot not found');
  }

  async listIntents(input: {
    organizationId: string;
    siteId: string;
    search?: string | undefined;
  }): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select *
      from chatbot_intents
      where organization_id = $1
        and site_id = $2
        and ($3::text is null or name ilike $3 or slug ilike $3 or category ilike $3)
      order by priority desc, name asc
      `,
      [input.organizationId, input.siteId, like(input.search)]
    );

    return result.rows;
  }

  async createIntent(
    organizationId: string,
    siteId: string,
    input: KnowledgeIntentInput
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into chatbot_intents (
        id, organization_id, site_id, name, slug, description, category, examples, synonyms, priority, is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *
      `,
      [
        randomUUID(),
        organizationId,
        siteId,
        input.name,
        input.slug ?? slugify(input.name),
        input.description ?? null,
        input.category ?? 'general',
        input.examples ?? [],
        input.synonyms ?? [],
        input.priority ?? 50,
        input.isActive ?? true
      ]
    );

    return requireRow(result.rows[0], 'Intent was not created');
  }

  async updateIntent(
    id: string,
    organizationId: string,
    input: LoosePartial<KnowledgeIntentInput>
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      update chatbot_intents
      set
        name = coalesce($3, name),
        slug = coalesce($4, slug),
        description = coalesce($5, description),
        category = coalesce($6, category),
        examples = coalesce($7, examples),
        synonyms = coalesce($8, synonyms),
        priority = coalesce($9, priority),
        is_active = coalesce($10, is_active),
        updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [
        id,
        organizationId,
        input.name ?? null,
        input.slug ?? null,
        input.description ?? null,
        input.category ?? null,
        input.examples ?? null,
        input.synonyms ?? null,
        input.priority ?? null,
        input.isActive ?? null
      ]
    );

    return result.rows[0] ?? null;
  }

  async deleteIntent(id: string, organizationId: string): Promise<void> {
    await this.database.query(
      `delete from chatbot_intents where id = $1 and organization_id = $2`,
      [id, organizationId]
    );
  }

  async listKnowledge(input: {
    organizationId: string;
    siteId: string;
    search?: string | undefined;
    status?: string | undefined;
    intentId?: string | undefined;
  }): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select k.*, i.name as intent_name
      from knowledge_items k
      left join chatbot_intents i on i.id = k.intent_id
      where k.organization_id = $1
        and k.site_id = $2
        and ($3::text is null or k.status = $3)
        and ($4::uuid is null or k.intent_id = $4)
        and ($5::text is null or k.title ilike $5 or k.main_question ilike $5 or k.short_answer ilike $5)
      order by k.priority desc, k.updated_at desc
      limit 250
      `,
      [
        input.organizationId,
        input.siteId,
        input.status ?? null,
        input.intentId ?? null,
        like(input.search)
      ]
    );

    return result.rows;
  }

  async getKnowledge(id: string, organizationId: string): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from knowledge_items where id = $1 and organization_id = $2`,
      [id, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async createKnowledge(
    organizationId: string,
    siteId: string,
    input: KnowledgeItemInput
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into knowledge_items (
        id, organization_id, site_id, intent_id, title, main_question, alternative_questions,
        short_answer, detailed_answer, commercial_answer, reassurance_answer, links,
        cta_label, cta_url, conditions, tags, priority, status, version,
        created_by_user_id, updated_by_user_id
      )
      values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, 1,
        $19, $19
      )
      returning *
      `,
      [
        randomUUID(),
        organizationId,
        siteId,
        input.intentId ?? null,
        input.title,
        input.mainQuestion,
        input.alternativeQuestions ?? [],
        input.shortAnswer,
        input.detailedAnswer ?? null,
        input.commercialAnswer ?? null,
        input.reassuranceAnswer ?? null,
        input.links ?? [],
        input.ctaLabel ?? null,
        input.ctaUrl ?? null,
        input.conditions ?? null,
        input.tags ?? [],
        input.priority ?? 50,
        input.status ?? 'draft',
        input.userId ?? null
      ]
    );

    return requireRow(result.rows[0], 'Knowledge item was not created');
  }

  async updateKnowledge(
    id: string,
    organizationId: string,
    input: LoosePartial<KnowledgeItemInput>
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      update knowledge_items
      set
        intent_id = coalesce($3, intent_id),
        title = coalesce($4, title),
        main_question = coalesce($5, main_question),
        alternative_questions = coalesce($6, alternative_questions),
        short_answer = coalesce($7, short_answer),
        detailed_answer = coalesce($8, detailed_answer),
        commercial_answer = coalesce($9, commercial_answer),
        reassurance_answer = coalesce($10, reassurance_answer),
        links = coalesce($11, links),
        cta_label = coalesce($12, cta_label),
        cta_url = coalesce($13, cta_url),
        conditions = coalesce($14, conditions),
        tags = coalesce($15, tags),
        priority = coalesce($16, priority),
        status = coalesce($17, status),
        version = version + 1,
        updated_by_user_id = coalesce($18, updated_by_user_id),
        updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [
        id,
        organizationId,
        input.intentId ?? null,
        input.title ?? null,
        input.mainQuestion ?? null,
        input.alternativeQuestions ?? null,
        input.shortAnswer ?? null,
        input.detailedAnswer ?? null,
        input.commercialAnswer ?? null,
        input.reassuranceAnswer ?? null,
        input.links ?? null,
        input.ctaLabel ?? null,
        input.ctaUrl ?? null,
        input.conditions ?? null,
        input.tags ?? null,
        input.priority ?? null,
        input.status ?? null,
        input.userId ?? null
      ]
    );

    return result.rows[0] ?? null;
  }

  async duplicateKnowledge(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into knowledge_items (
        id, organization_id, site_id, intent_id, title, main_question, alternative_questions,
        short_answer, detailed_answer, commercial_answer, reassurance_answer, links,
        cta_label, cta_url, conditions, tags, priority, status, version, created_by_user_id, updated_by_user_id
      )
      select
        $1, organization_id, site_id, intent_id, title || ' (copie)', main_question, alternative_questions,
        short_answer, detailed_answer, commercial_answer, reassurance_answer, links,
        cta_label, cta_url, conditions, tags, priority, 'draft', 1, $3, $3
      from knowledge_items
      where id = $2 and organization_id = $4
      returning *
      `,
      [randomUUID(), id, userId, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async setKnowledgeStatus(
    id: string,
    organizationId: string,
    status: (typeof knowledgeItemStatuses)[number],
    userId: string
  ): Promise<Record<string, unknown> | null> {
    return this.updateKnowledge(id, organizationId, { status, userId });
  }

  async deleteKnowledge(id: string, organizationId: string): Promise<void> {
    await this.setKnowledgeStatus(id, organizationId, 'archived', '');
  }

  async answerQuestion(input: {
    organizationId: string;
    siteId: string;
    question: string;
  }): Promise<KnowledgeAnswer | null> {
    const tokens = tokenize(input.question);
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        k.*,
        i.name as intent_name,
        i.synonyms as intent_synonyms,
        (
          case when lower(k.main_question) = lower($3) then 80 else 0 end
          + case when k.main_question ilike $4 then 30 else 0 end
          + cardinality(array(select unnest(k.alternative_questions) intersect select unnest($5::text[]))) * 20
          + cardinality(array(select unnest(k.tags) intersect select unnest($5::text[]))) * 15
          + coalesce(k.priority, 0)
        ) as match_score
      from knowledge_items k
      left join chatbot_intents i on i.id = k.intent_id
      where k.organization_id = $1
        and k.site_id = $2
        and k.status = 'active'
        and (
          lower(k.main_question) = lower($3)
          or k.main_question ilike $4
          or exists (select 1 from unnest(k.alternative_questions) q where lower(q) = any($5::text[]))
          or exists (select 1 from unnest(k.tags) tag where lower(tag) = any($5::text[]))
          or exists (select 1 from unnest(i.synonyms) syn where lower(syn) = any($5::text[]))
        )
      order by match_score desc, k.priority desc, k.updated_at desc
      limit 1
      `,
      [input.organizationId, input.siteId, input.question, `%${input.question}%`, tokens]
    );
    const item = result.rows[0];
    if (!item) return null;
    const reply = selectAnswer(item);
    const confidence = Math.min(0.99, Math.max(0.55, Number(item.match_score ?? 50) / 120));

    return {
      reply,
      source: 'knowledge_engine',
      confidence,
      matchedItemId: String(item.id),
      detectedIntent: typeof item.intent_name === 'string' ? item.intent_name : undefined,
      reason: `knowledge:${String(item.status)}`
    };
  }

  async enhancedUnanswered(input: {
    organizationId: string;
    siteId: string;
    conversationId: string;
    question: string;
    detectedIntent?: string | undefined;
    confidenceScore?: number | undefined;
  }): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into chatbot_unanswered_questions (
        id, organization_id, site_id, conversation_id, question,
        detected_intent, occurrence_count, last_seen_at, confidence_score, action_status
      )
      values ($1, $2, $3, $4, $5, $6, 1, now(), $7, 'pending')
      on conflict (site_id, question)
      do update set
        occurrence_count = chatbot_unanswered_questions.occurrence_count + 1,
        last_seen_at = now(),
        detected_intent = coalesce(excluded.detected_intent, chatbot_unanswered_questions.detected_intent),
        confidence_score = coalesce(excluded.confidence_score, chatbot_unanswered_questions.confidence_score),
        updated_at = now()
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.conversationId,
        input.question,
        input.detectedIntent ?? null,
        input.confidenceScore ?? null
      ]
    );

    return requireRow(result.rows[0], 'Unanswered question was not recorded');
  }

  async generateSuggestion(
    unansweredId: string,
    organizationId: string
  ): Promise<Record<string, unknown>> {
    const unanswered = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_unanswered_questions where id = $1 and organization_id = $2`,
      [unansweredId, organizationId]
    );
    const source = requireRow(unanswered.rows[0], 'Unanswered question not found');
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into knowledge_suggestions (
        id, organization_id, site_id, source_type, source_id, suggested_intent,
        suggested_question, suggested_answer, suggested_tags, confidence_score, status
      )
      values ($1, $2, $3, 'unanswered_question', $4, $5, $6, $7, $8, $9, 'pending')
      returning *
      `,
      [
        randomUUID(),
        organizationId,
        source.site_id,
        unansweredId,
        source.detected_intent ?? 'general',
        source.question,
        source.suggested_answer ?? "Réponse à compléter par l'administrateur.",
        source.tags ?? [],
        source.confidence_score ?? 0.35
      ]
    );

    return requireRow(result.rows[0], 'Suggestion was not created');
  }

  async listSuggestions(
    organizationId: string,
    siteId: string
  ): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from knowledge_suggestions where organization_id = $1 and site_id = $2 order by created_at desc limit 200`,
      [organizationId, siteId]
    );

    return result.rows;
  }

  async acceptSuggestion(
    id: string,
    organizationId: string,
    userId: string,
    input: LoosePartial<KnowledgeItemInput> = {}
  ): Promise<{ suggestion: Record<string, unknown>; knowledge: Record<string, unknown> }> {
    const suggestion = await this.database.query<Record<string, unknown>>(
      `select * from knowledge_suggestions where id = $1 and organization_id = $2`,
      [id, organizationId]
    );
    const source = requireRow(suggestion.rows[0], 'Suggestion not found');
    const status = input.status ?? 'draft';
    if (status !== 'draft' && status !== 'needs_review') {
      throw new AppError('Suggestion acceptance cannot publish knowledge', {
        statusCode: 400,
        code: 'KNOWLEDGE_SUGGESTION_STATUS_NOT_ALLOWED'
      });
    }
    const knowledge = await this.createKnowledge(organizationId, String(source.site_id), {
      title: input.title ?? String(source.suggested_question),
      mainQuestion: input.mainQuestion ?? String(source.suggested_question),
      alternativeQuestions: input.alternativeQuestions,
      shortAnswer: input.shortAnswer ?? String(source.suggested_answer),
      detailedAnswer: input.detailedAnswer,
      commercialAnswer: input.commercialAnswer,
      reassuranceAnswer: input.reassuranceAnswer,
      links: input.links,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      conditions: input.conditions,
      tags:
        input.tags ??
        (Array.isArray(source.suggested_tags) ? (source.suggested_tags as string[]) : []),
      priority: input.priority,
      intentId: input.intentId,
      status,
      userId
    });
    const updated = await this.database.query<Record<string, unknown>>(
      `update knowledge_suggestions set status = 'accepted', updated_at = now() where id = $1 and organization_id = $2 returning *`,
      [id, organizationId]
    );

    return { suggestion: requireRow(updated.rows[0], 'Suggestion was not accepted'), knowledge };
  }

  async rejectSuggestion(
    id: string,
    organizationId: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `update knowledge_suggestions set status = 'rejected', updated_at = now() where id = $1 and organization_id = $2 returning *`,
      [id, organizationId]
    );

    return result.rows[0] ?? null;
  }

  async listFlows(organizationId: string, siteId: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from conversation_flows where organization_id = $1 and site_id = $2 order by created_at desc`,
      [organizationId, siteId]
    );

    return result.rows;
  }

  async createFlow(
    organizationId: string,
    siteId: string,
    input: FlowInput
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into conversation_flows (id, organization_id, site_id, name, description, trigger_intent_id, is_active)
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
      `,
      [
        randomUUID(),
        organizationId,
        siteId,
        input.name,
        input.description ?? null,
        input.triggerIntentId ?? null,
        input.isActive ?? true
      ]
    );

    return requireRow(result.rows[0], 'Flow was not created');
  }

  async getFlow(id: string, organizationId: string): Promise<Record<string, unknown> | null> {
    const flow = await this.database.query<Record<string, unknown>>(
      `select * from conversation_flows where id = $1 and organization_id = $2`,
      [id, organizationId]
    );
    const steps = await this.database.query<Record<string, unknown>>(
      `select * from conversation_flow_steps where flow_id = $1 order by step_order asc`,
      [id]
    );

    return flow.rows[0] ? { ...flow.rows[0], steps: steps.rows } : null;
  }

  async updateFlow(
    id: string,
    organizationId: string,
    input: LoosePartial<FlowInput>
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      update conversation_flows
      set
        name = coalesce($3, name),
        description = coalesce($4, description),
        trigger_intent_id = coalesce($5, trigger_intent_id),
        is_active = coalesce($6, is_active),
        updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [
        id,
        organizationId,
        input.name ?? null,
        input.description ?? null,
        input.triggerIntentId ?? null,
        input.isActive ?? null
      ]
    );

    return result.rows[0] ?? null;
  }

  async deleteFlow(id: string, organizationId: string): Promise<void> {
    await this.database.query(
      `delete from conversation_flows where id = $1 and organization_id = $2`,
      [id, organizationId]
    );
  }

  async addFlowStep(input: FlowStepInput): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into conversation_flow_steps (
        id, flow_id, step_order, step_type, content, conditions, next_step_id, action_type, metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
      `,
      [
        randomUUID(),
        input.flowId,
        input.stepOrder,
        input.stepType,
        input.content,
        input.conditions ?? null,
        input.nextStepId ?? null,
        input.actionType ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );

    return requireRow(result.rows[0], 'Flow step was not created');
  }

  async updateFlowStep(
    id: string,
    input: LoosePartial<FlowStepInput>
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      update conversation_flow_steps
      set
        step_order = coalesce($2, step_order),
        step_type = coalesce($3, step_type),
        content = coalesce($4, content),
        conditions = coalesce($5, conditions),
        next_step_id = coalesce($6, next_step_id),
        action_type = coalesce($7, action_type),
        metadata = coalesce($8, metadata),
        updated_at = now()
      where id = $1
      returning *
      `,
      [
        id,
        input.stepOrder ?? null,
        input.stepType ?? null,
        input.content ?? null,
        input.conditions ?? null,
        input.nextStepId ?? null,
        input.actionType ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null
      ]
    );

    return result.rows[0] ?? null;
  }

  async deleteFlowStep(id: string): Promise<void> {
    await this.database.query(`delete from conversation_flow_steps where id = $1`, [id]);
  }

  async getPersonality(
    organizationId: string,
    siteId: string
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_personality where organization_id = $1 and site_id = $2`,
      [organizationId, siteId]
    );

    return result.rows[0] ?? null;
  }

  async savePersonality(
    organizationId: string,
    siteId: string,
    input: PersonalityInput
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into chatbot_personality (
        id, organization_id, site_id, tone, style, answer_length, formality, emoji_level,
        commercial_intensity, reassurance_level
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (site_id)
      do update set
        tone = excluded.tone,
        style = excluded.style,
        answer_length = excluded.answer_length,
        formality = excluded.formality,
        emoji_level = excluded.emoji_level,
        commercial_intensity = excluded.commercial_intensity,
        reassurance_level = excluded.reassurance_level,
        updated_at = now()
      returning *
      `,
      [
        randomUUID(),
        organizationId,
        siteId,
        input.tone,
        input.style ?? null,
        input.answerLength,
        input.formality,
        input.emojiLevel,
        input.commercialIntensity,
        input.reassuranceLevel
      ]
    );

    return requireRow(result.rows[0], 'Personality was not saved');
  }

  async listGoals(organizationId: string, siteId: string): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `select * from chatbot_goals where organization_id = $1 and site_id = $2 order by priority desc, created_at desc`,
      [organizationId, siteId]
    );

    return result.rows;
  }

  async createGoal(
    organizationId: string,
    siteId: string,
    input: GoalInput
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      insert into chatbot_goals (id, organization_id, site_id, goal_type, description, priority, success_action, is_active)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning *
      `,
      [
        randomUUID(),
        organizationId,
        siteId,
        input.goalType,
        input.description,
        input.priority ?? 50,
        input.successAction ?? null,
        input.isActive ?? true
      ]
    );

    return requireRow(result.rows[0], 'Goal was not created');
  }

  async updateGoal(
    id: string,
    organizationId: string,
    input: LoosePartial<GoalInput>
  ): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      update chatbot_goals
      set
        goal_type = coalesce($3, goal_type),
        description = coalesce($4, description),
        priority = coalesce($5, priority),
        success_action = coalesce($6, success_action),
        is_active = coalesce($7, is_active),
        updated_at = now()
      where id = $1 and organization_id = $2
      returning *
      `,
      [
        id,
        organizationId,
        input.goalType ?? null,
        input.description ?? null,
        input.priority ?? null,
        input.successAction ?? null,
        input.isActive ?? null
      ]
    );

    return result.rows[0] ?? null;
  }

  async deleteGoal(id: string, organizationId: string): Promise<void> {
    await this.database.query(`delete from chatbot_goals where id = $1 and organization_id = $2`, [
      id,
      organizationId
    ]);
  }
}

function selectAnswer(item: Record<string, unknown>): string {
  return String(
    item.commercial_answer ??
      item.reassurance_answer ??
      item.detailed_answer ??
      item.short_answer ??
      item.main_question
  );
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3)
    .slice(0, 30);
}

function like(value?: string): string | null {
  return value ? `%${value}%` : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new AppError(message, { statusCode: 404, code: 'KNOWLEDGE_ENGINE_NOT_FOUND' });

  return row;
}
