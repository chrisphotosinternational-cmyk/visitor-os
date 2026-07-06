import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export type SiteRecord = {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  widget_public_key: string;
  activity: string;
  business_config_id: string;
  status: string;
  widget_enabled: boolean;
  domain: string | null;
  allowed_domains: string[] | null;
  widget_primary_color: string | null;
  widget_welcome_message: string | null;
  widget_fallback_message: string | null;
  widget_privacy_message: string | null;
  lead_capture_enabled: boolean | null;
  lead_capture_trigger: string | null;
  lead_capture_after_messages: number | null;
  lead_capture_fields: string[] | null;
};

export type ConversationRecord = {
  id: string;
  organization_id: string;
  site_id: string;
  visitor_id: string;
  prospect_id: string | null;
  status: string;
  page_url: string | null;
  referrer: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ConversationStatus = 'open' | 'in_review' | 'qualified' | 'closed';

export const conversationStatuses: readonly ConversationStatus[] = [
  'open',
  'in_review',
  'qualified',
  'closed'
] as const;

export type MessageRecord = {
  id: string;
  organization_id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'assistant' | 'system';
  content: string;
  response_source: string | null;
  response_confidence: number | null;
  should_escalate: boolean | null;
  processing_time_ms: number | null;
  matched_item_id: string | null;
  decision_reason: string | null;
  created_at: Date;
};

export type DecisionMetadata = {
  responseSource: string;
  responseConfidence: number;
  shouldEscalate: boolean;
  processingTimeMs: number;
  matchedItemId?: string;
  decisionReason?: string;
};

export type AdminConversationListItem = {
  id: string;
  status: ConversationStatus;
  created_at: Date;
  updated_at: Date;
  page_url: string | null;
  prospect_id: string | null;
  display_name: string | null;
  prospect_status: string | null;
  last_message: string | null;
};

export type AdminConversationDetail = AdminConversationListItem & {
  messages: MessageRecord[];
};

export class ConversationRepository {
  constructor(private readonly database: Database) {}

  async findSiteByWidgetKey(widgetKey: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `select * from sites where widget_public_key = $1 and status = 'active' and widget_enabled = true`,
      [widgetKey]
    );

    return result.rows[0] ?? null;
  }

  async findSite(id: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(`select * from sites where id = $1`, [id]);

    return result.rows[0] ?? null;
  }

  async findSiteBySlug(slug: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `select * from sites where slug = $1 and status = 'active' and widget_enabled = true`,
      [slug]
    );

    return result.rows[0] ?? null;
  }

  async upsertVisitor(input: {
    organizationId: string;
    siteId: string;
    anonymousId: string;
  }): Promise<string> {
    const id = randomUUID();
    const result = await this.database.query<{ id: string }>(
      `
      insert into visitors (id, organization_id, site_id, anonymous_id)
      values ($1, $2, $3, $4)
      on conflict (site_id, anonymous_id)
      do update set last_seen_at = now()
      returning id
      `,
      [id, input.organizationId, input.siteId, input.anonymousId]
    );

    return result.rows[0]?.id ?? id;
  }

  async createConversation(input: {
    organizationId: string;
    siteId: string;
    visitorId: string;
    pageUrl?: string;
    referrer?: string;
  }): Promise<ConversationRecord> {
    const result = await this.database.query<ConversationRecord>(
      `
      insert into conversations (id, organization_id, site_id, visitor_id, page_url, referrer)
      values ($1, $2, $3, $4, $5, $6)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.visitorId,
        input.pageUrl ?? null,
        input.referrer ?? null
      ]
    );

    return requireRow(result.rows[0], 'Conversation was not created');
  }

  async findConversation(id: string, organizationId?: string): Promise<ConversationRecord | null> {
    const result = organizationId
      ? await this.database.query<ConversationRecord>(
          `select * from conversations where id = $1 and organization_id = $2`,
          [id, organizationId]
        )
      : await this.database.query<ConversationRecord>(`select * from conversations where id = $1`, [
          id
        ]);

    return result.rows[0] ?? null;
  }

  async addMessage(input: {
    organizationId: string;
    conversationId: string;
    senderType: MessageRecord['sender_type'];
    content: string;
    decision?: DecisionMetadata;
  }): Promise<MessageRecord> {
    const result = await this.database.query<MessageRecord>(
      `
      insert into messages (
        id,
        organization_id,
        conversation_id,
        sender_type,
        content,
        response_source,
        response_confidence,
        should_escalate,
        processing_time_ms,
        matched_item_id,
        decision_reason
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.conversationId,
        input.senderType,
        input.content,
        input.decision?.responseSource ?? null,
        input.decision?.responseConfidence ?? null,
        input.decision?.shouldEscalate ?? null,
        input.decision?.processingTimeMs ?? null,
        input.decision?.matchedItemId ?? null,
        input.decision?.decisionReason ?? null
      ]
    );

    return requireRow(result.rows[0], 'Message was not created');
  }

  async addDecisionEvent(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    source: string;
    confidence: number;
    shouldEscalate: boolean;
    processingTimeMs: number;
    matchedItemId?: string;
    reason?: string;
  }): Promise<void> {
    await this.database.query(
      `
      insert into decision_events (
        id,
        organization_id,
        conversation_id,
        message_id,
        source,
        confidence,
        should_escalate,
        processing_time_ms,
        matched_item_id,
        reason
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.conversationId,
        input.messageId,
        input.source,
        input.confidence,
        input.shouldEscalate,
        input.processingTimeMs,
        input.matchedItemId ?? null,
        input.reason ?? null
      ]
    );
  }

  async addAIEvent(input: {
    organizationId: string;
    siteId: string;
    conversationId: string;
    provider: string;
    model: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
    fallbackUsed: boolean;
  }): Promise<void> {
    await this.database.query(
      `
      insert into ai_events (
        id,
        organization_id,
        site_id,
        conversation_id,
        provider,
        model,
        latency_ms,
        input_tokens,
        output_tokens,
        estimated_cost,
        fallback_used
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.conversationId,
        input.provider,
        input.model,
        input.latencyMs,
        input.inputTokens,
        input.outputTokens,
        input.estimatedCost,
        input.fallbackUsed
      ]
    );
  }

  async linkProspect(conversationId: string, prospectId: string): Promise<void> {
    await this.database.query(
      `update conversations set prospect_id = $1, updated_at = now() where id = $2`,
      [prospectId, conversationId]
    );
  }

  async listMessages(conversationId: string, organizationId?: string): Promise<MessageRecord[]> {
    const result = organizationId
      ? await this.database.query<MessageRecord>(
          `select * from messages where conversation_id = $1 and organization_id = $2 order by created_at asc`,
          [conversationId, organizationId]
        )
      : await this.database.query<MessageRecord>(
          `select * from messages where conversation_id = $1 order by created_at asc`,
          [conversationId]
        );

    return result.rows;
  }

  async listAdminConversations(input?: {
    organizationId?: string;
    search?: string;
  }): Promise<AdminConversationListItem[]> {
    const organizationId = input?.organizationId;
    const search = input?.search;
    const searchValue = search?.trim();

    if (searchValue) {
      const result = await this.database.query<AdminConversationListItem>(
        `
        select
          c.id,
          c.status,
          c.created_at,
          c.updated_at,
          c.page_url,
          c.prospect_id,
          p.display_name,
          p.status as prospect_status,
          (
            select m.content
            from messages m
            where m.conversation_id = c.id
            order by m.created_at desc
            limit 1
          ) as last_message
        from conversations c
        left join prospects p on p.id = c.prospect_id
        where
          ($2::uuid is null or c.organization_id = $2)
          and (
          p.display_name ilike $1
          or exists (
            select 1
            from messages m
            where m.conversation_id = c.id and m.content ilike $1
          )
          )
        order by c.updated_at desc, c.created_at desc
        limit 100
        `,
        [`%${searchValue}%`, organizationId ?? null]
      );

      return result.rows;
    }

    const result = await this.database.query<AdminConversationListItem>(
      `
      select
        c.id,
        c.status,
        c.created_at,
        c.updated_at,
        c.page_url,
        c.prospect_id,
        p.display_name,
        p.status as prospect_status,
        (
          select m.content
          from messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) as last_message
      from conversations c
      left join prospects p on p.id = c.prospect_id
      where ($1::uuid is null or c.organization_id = $1)
      order by c.updated_at desc, c.created_at desc
      limit 100
      `,
      [organizationId ?? null]
    );

    return result.rows;
  }

  async findAdminConversation(
    id: string,
    organizationId?: string
  ): Promise<AdminConversationDetail | null> {
    const result = await this.database.query<AdminConversationListItem>(
      `
      select
        c.id,
        c.status,
        c.created_at,
        c.updated_at,
        c.page_url,
        c.prospect_id,
        p.display_name,
        p.status as prospect_status,
        (
          select m.content
          from messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) as last_message
      from conversations c
      left join prospects p on p.id = c.prospect_id
      where c.id = $1 and ($2::uuid is null or c.organization_id = $2)
      `,
      [id, organizationId ?? null]
    );
    const conversation = result.rows[0];

    if (!conversation) {
      return null;
    }

    return {
      ...conversation,
      messages: await this.listMessages(id, organizationId)
    };
  }

  async updateStatus(
    id: string,
    status: ConversationStatus
  ): Promise<AdminConversationDetail | null> {
    await this.database.query(
      `update conversations set status = $1, updated_at = now() where id = $2`,
      [status, id]
    );

    return this.findAdminConversation(id);
  }
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
