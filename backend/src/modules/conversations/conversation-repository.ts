import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export type SiteRecord = {
  id: string;
  organization_id: string;
  name: string;
  activity: string;
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

export type MessageRecord = {
  id: string;
  organization_id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'assistant' | 'system';
  content: string;
  created_at: Date;
};

export class ConversationRepository {
  constructor(private readonly database: Database) {}

  async findSiteByWidgetKey(widgetKey: string): Promise<SiteRecord | null> {
    const result = await this.database.query<SiteRecord>(
      `select id, organization_id, name, activity from sites where widget_public_key = $1`,
      [widgetKey]
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

  async findConversation(id: string): Promise<ConversationRecord | null> {
    const result = await this.database.query<ConversationRecord>(
      `select * from conversations where id = $1`,
      [id]
    );

    return result.rows[0] ?? null;
  }

  async addMessage(input: {
    organizationId: string;
    conversationId: string;
    senderType: MessageRecord['sender_type'];
    content: string;
  }): Promise<MessageRecord> {
    const result = await this.database.query<MessageRecord>(
      `
      insert into messages (id, organization_id, conversation_id, sender_type, content)
      values ($1, $2, $3, $4, $5)
      returning *
      `,
      [randomUUID(), input.organizationId, input.conversationId, input.senderType, input.content]
    );

    return requireRow(result.rows[0], 'Message was not created');
  }

  async linkProspect(conversationId: string, prospectId: string): Promise<void> {
    await this.database.query(
      `update conversations set prospect_id = $1, updated_at = now() where id = $2`,
      [prospectId, conversationId]
    );
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const result = await this.database.query<MessageRecord>(
      `select * from messages where conversation_id = $1 order by created_at asc`,
      [conversationId]
    );

    return result.rows;
  }
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }

  return row;
}
