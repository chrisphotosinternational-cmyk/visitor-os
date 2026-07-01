import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

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
};

export class ProspectRepository {
  constructor(private readonly database: Database) {}

  async createFromConversation(input: {
    organizationId: string;
    siteId: string;
    visitorId: string;
    question: string;
  }): Promise<ProspectRecord> {
    const score = calculateInitialScore(input.question);
    const temperature = score >= 70 ? 'chaude' : score >= 40 ? 'tiede' : 'froide';
    const status: ProspectStatus = score >= 70 ? 'Interesse' : 'Nouveau';

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
        temperature,
        score
      ]
    );

    return requireRow(result.rows[0], 'Prospect was not created');
  }

  async list(): Promise<ProspectRecord[]> {
    const result = await this.database.query<ProspectRecord>(
      `select * from prospects order by updated_at desc, created_at desc limit 100`
    );

    return result.rows;
  }

  async findDetail(id: string): Promise<ProspectDetail | null> {
    const prospectResult = await this.database.query<ProspectRecord>(
      `select * from prospects where id = $1`,
      [id]
    );
    const prospect = prospectResult.rows[0];

    if (!prospect) {
      return null;
    }

    const conversationsResult = await this.database.query<{
      id: string;
      status: string;
      page_url: string | null;
      created_at: Date;
    }>(`select id, status, page_url, created_at from conversations where prospect_id = $1`, [id]);

    const conversations = await Promise.all(
      conversationsResult.rows.map(async (conversation) => {
        const messagesResult = await this.database.query<{
          id: string;
          sender_type: string;
          content: string;
          created_at: Date;
        }>(
          `select id, sender_type, content, created_at
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

    return {
      ...prospect,
      conversations
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

function calculateInitialScore(question: string): number {
  const normalized = question.toLowerCase();
  let score = 35;

  if (/(prix|tarif|devis|budget)/.test(normalized)) score += 15;
  if (/(disponible|disponibilite|réserver|reserver|reservation|réservation)/.test(normalized)) {
    score += 25;
  }
  if (/(urgent|aujourd'hui|demain|vite)/.test(normalized)) score += 15;

  return Math.min(score, 100);
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
