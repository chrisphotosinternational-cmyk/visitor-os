import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';

export type ChatSession = {
  id: string;
  organization_id: string;
  user_id: string | null;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type ChatMessage = {
  id: string;
  session_id: string;
  organization_id: string;
  user_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  intent: string | null;
  citations: ChatCitation[];
  result_csv: string | null;
  created_at: Date;
};

export type ChatCitation = {
  prospectId?: string;
  prospect?: string;
  score?: number;
  status?: string;
  city?: string | null;
  lastAction?: string | null;
  source: string;
};

export type ChatAnswer = {
  session: ChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  answer: {
    intent: string;
    content: string;
    citations: ChatCitation[];
    prospects: ChatProspectCard[];
    csv: string;
    refused: boolean;
  };
};

type ChatProspectCard = {
  id: string;
  displayName: string;
  score: number;
  scoreLabel: string;
  status: string;
  city: string | null;
  platform: string | null;
  lastAction: string | null;
};

type ChatProspectRow = {
  id: string;
  display_name: string;
  score: number;
  score_label: string;
  status: string;
  city: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  twitter_x: string | null;
  mym: string | null;
  onlyfans: string | null;
  website: string | null;
  linktree: string | null;
  allmylinks: string | null;
  last_action: string | null;
  follow_up_date: Date | null;
};

type PipelineSummaryRow = {
  status: string;
  count: string;
  average_score: string | null;
};

type AnalysisRow = {
  prospect_id: string;
  summary: string;
  recommended_offer: string;
  priority: string;
  confidence: number;
};

export class AIChatService {
  constructor(private readonly database: Database) {}

  async createSession(input: {
    organizationId: string;
    userId: string;
    title?: string;
  }): Promise<ChatSession> {
    const result = await this.database.query<ChatSession>(
      `
      insert into ai_chat_sessions (id, organization_id, user_id, title)
      values ($1, $2, $3, $4)
      returning *
      `,
      [
        randomUUID(),
        input.organizationId,
        input.userId,
        input.title?.trim() || 'Nouvelle conversation'
      ]
    );

    return requireRow(result.rows[0], 'Chat session was not created');
  }

  async listSessions(organizationId: string): Promise<ChatSession[]> {
    const result = await this.database.query<ChatSession>(
      `
      select *
      from ai_chat_sessions
      where organization_id = $1
      order by updated_at desc, created_at desc
      limit 50
      `,
      [organizationId]
    );

    return result.rows;
  }

  async getSession(
    id: string,
    organizationId: string
  ): Promise<{ session: ChatSession; messages: ChatMessage[] } | null> {
    const sessionResult = await this.database.query<ChatSession>(
      `select * from ai_chat_sessions where id = $1 and organization_id = $2`,
      [id, organizationId]
    );
    const session = sessionResult.rows[0];
    if (!session) return null;

    const messagesResult = await this.database.query<ChatMessage>(
      `
      select *
      from ai_chat_messages
      where session_id = $1 and organization_id = $2
      order by created_at asc
      `,
      [id, organizationId]
    );

    return { session, messages: messagesResult.rows.map(normalizeMessage) };
  }

  async sendMessage(input: {
    sessionId: string;
    organizationId: string;
    userId: string;
    content: string;
  }): Promise<ChatAnswer | null> {
    const session = await this.requireSession(input.sessionId, input.organizationId);
    if (!session) return null;

    const userMessage = await this.insertMessage({
      sessionId: session.id,
      organizationId: input.organizationId,
      userId: input.userId,
      role: 'user',
      content: input.content,
      intent: 'user_question',
      citations: [],
      resultCsv: null
    });
    const answer = await this.answerQuestion(input.organizationId, input.content);
    const assistantMessage = await this.insertMessage({
      sessionId: session.id,
      organizationId: input.organizationId,
      userId: input.userId,
      role: 'assistant',
      content: answer.content,
      intent: answer.intent,
      citations: answer.citations,
      resultCsv: answer.csv
    });
    await Promise.all([
      this.touchSession(session.id),
      this.logChatRequest(input.organizationId, input.userId, session.id, answer.intent)
    ]);

    return {
      session,
      userMessage,
      assistantMessage,
      answer: {
        ...answer,
        prospects: answer.prospects.map(toProspectCard)
      }
    };
  }

  private async answerQuestion(
    organizationId: string,
    question: string
  ): Promise<{
    intent: string;
    content: string;
    citations: ChatCitation[];
    prospects: ChatProspectRow[];
    csv: string;
    refused: boolean;
  }> {
    const normalized = normalizeQuestion(question);
    if (isMutationRequest(normalized)) {
      return {
        intent: 'refused_mutation',
        content:
          "Je peux analyser et préparer une liste d'action, mais je ne peux pas modifier, supprimer ou envoyer quoi que ce soit sans confirmation explicite dans l'interface dédiée.",
        citations: [],
        prospects: [],
        csv: '',
        refused: true
      };
    }

    if (normalized.includes('pipeline')) {
      return this.pipelineSummary(organizationId);
    }

    if (normalized.includes('relanc')) {
      return this.prospectListAnswer({
        organizationId,
        intent: 'follow_ups',
        title: 'Prospects a relancer',
        where: "ch.follow_up_date is not null and ch.follow_up_date <= now() + interval '7 days'",
        source: 'contact_history.follow_up_date',
        limit: 30
      });
    }

    if (normalized.includes('interess') && !normalized.includes('sign')) {
      return this.prospectListAnswer({
        organizationId,
        intent: 'interested_not_signed',
        title: 'Prospects interesses mais non signes',
        where: "p.status in ('interested', 'potential_client')",
        source: 'prospects.status',
        limit: 30
      });
    }

    if (normalized.includes('mym') || normalized.includes('onlyfans')) {
      return this.prospectListAnswer({
        organizationId,
        intent: 'premium_platform_priority',
        title: 'Profils MYM / OnlyFans prioritaires',
        where:
          "((p.mym is not null and p.mym <> '') or (p.onlyfans is not null and p.onlyfans <> '')) and p.status not in ('signed_client', 'refused', 'blacklist')",
        source: 'prospects.mym/onlyfans',
        limit: 30
      });
    }

    if (
      normalized.includes('email') &&
      normalized.includes('telephone') &&
      normalized.includes('instagram')
    ) {
      return this.prospectListAnswer({
        organizationId,
        intent: 'complete_contact_channels',
        title: 'Prospects avec email, telephone et Instagram',
        where:
          "p.email is not null and p.email <> '' and p.phone is not null and p.phone <> '' and p.instagram is not null and p.instagram <> ''",
        source: 'prospects.contact_fields',
        limit: 50
      });
    }

    const city = extractCity(normalized);
    if (city && normalized.includes('jamais') && normalized.includes('contact')) {
      return this.prospectListAnswer({
        organizationId,
        intent: 'city_never_contacted',
        title: `Prospects a ${capitalize(city)} jamais contactes`,
        where:
          'lower(p.city) = $2 and not exists (select 1 from contact_history cx where cx.prospect_id = p.id)',
        source: 'prospects.city + contact_history',
        values: [city],
        limit: 50
      });
    }

    const scoreThreshold = extractScoreThreshold(normalized);
    if (scoreThreshold !== null) {
      return this.prospectListAnswer({
        organizationId,
        intent: 'score_threshold',
        title: `Prospects avec score superieur a ${scoreThreshold}`,
        where: 'p.score >= $2',
        source: 'prospects.score',
        values: [scoreThreshold],
        limit: 50
      });
    }

    if (normalized.includes('analyse') || normalized.includes('opportunite')) {
      return this.aiAnalysisSummary(organizationId);
    }

    return this.prospectListAnswer({
      organizationId,
      intent: 'top_action_list',
      title: "Liste d'action pour aujourd'hui",
      where: "p.status not in ('signed_client', 'refused', 'blacklist')",
      source: 'prospects.score/status',
      limit: normalized.includes('20') ? 20 : 15
    });
  }

  private async prospectListAnswer(input: {
    organizationId: string;
    intent: string;
    title: string;
    where: string;
    source: string;
    values?: unknown[];
    limit: number;
  }) {
    const result = await this.database.query<ChatProspectRow>(
      `
      select
        p.id,
        p.display_name,
        p.score,
        p.score_label,
        p.status,
        p.city,
        p.email,
        p.phone,
        p.instagram,
        p.twitter_x,
        p.mym,
        p.onlyfans,
        p.website,
        p.linktree,
        p.allmylinks,
        ch.next_action as last_action,
        ch.follow_up_date
      from prospects p
      left join lateral (
        select next_action, follow_up_date
        from contact_history
        where prospect_id = p.id
        order by contact_date desc, created_at desc
        limit 1
      ) ch on true
      where p.organization_id = $1
        and ${input.where}
      order by p.score desc nulls last, p.updated_at desc
      limit ${Math.min(50, Math.max(1, input.limit))}
      `,
      [input.organizationId, ...(input.values ?? [])]
    );
    const citations = result.rows.map((prospect) => toCitation(prospect, input.source));
    const lines = result.rows.slice(0, 8).map((prospect, index) => {
      const platform = detectPlatform(prospect) ?? 'aucune plateforme principale';
      return `${index + 1}. ${prospect.display_name} - score ${prospect.score}, ${prospect.status}, ${prospect.city ?? 'ville inconnue'}, ${platform}`;
    });
    const content =
      result.rows.length > 0
        ? `${input.title} : ${result.rows.length} resultat(s).\n${lines.join('\n')}\n\nJe n'ai effectue aucune modification. Ouvre une fiche prospect pour agir manuellement.`
        : `${input.title} : aucun resultat trouve avec les filtres actuels.`;

    return {
      intent: input.intent,
      content,
      citations,
      prospects: result.rows,
      csv: prospectsToCsv(result.rows),
      refused: false
    };
  }

  private async pipelineSummary(organizationId: string) {
    const result = await this.database.query<PipelineSummaryRow>(
      `
      select status, count(*)::text as count, avg(score)::text as average_score
      from prospects
      where organization_id = $1
      group by status
      order by count(*) desc
      `,
      [organizationId]
    );
    const content =
      result.rows.length > 0
        ? [
            'Etat du pipeline :',
            ...result.rows.map(
              (row) =>
                `- ${row.status} : ${Number(row.count)} prospect(s), score moyen ${Math.round(Number(row.average_score ?? 0))}`
            ),
            '',
            "Je n'ai effectue aucune modification."
          ].join('\n')
        : 'Le pipeline ne contient pas encore de prospects.';

    return {
      intent: 'pipeline_summary',
      content,
      citations: result.rows.map((row) => ({ source: 'prospects.status', status: row.status })),
      prospects: [],
      csv: [
        'status,count,average_score',
        ...result.rows.map((row) => `${row.status},${row.count},${row.average_score ?? ''}`)
      ].join('\n'),
      refused: false
    };
  }

  private async aiAnalysisSummary(organizationId: string) {
    const result = await this.database.query<AnalysisRow>(
      `
      select distinct on (a.prospect_id)
        a.prospect_id,
        a.summary,
        a.recommended_offer,
        a.priority,
        a.confidence
      from prospect_ai_analysis a
      where a.organization_id = $1
      order by a.prospect_id, a.created_at desc
      limit 20
      `,
      [organizationId]
    );
    const content =
      result.rows.length > 0
        ? [
            `J'ai trouve ${result.rows.length} analyse(s) IA recente(s).`,
            ...result.rows
              .slice(0, 8)
              .map(
                (row, index) =>
                  `${index + 1}. Priorite ${row.priority}, confiance ${row.confidence}%, offre : ${row.recommended_offer}.`
              )
          ].join('\n')
        : "Aucune analyse IA n'est encore disponible pour cette organisation.";

    return {
      intent: 'ai_analysis_summary',
      content,
      citations: result.rows.map((row) => ({
        prospectId: row.prospect_id,
        source: 'prospect_ai_analysis',
        lastAction: row.recommended_offer
      })),
      prospects: [],
      csv: [
        'prospect_id,priority,confidence,recommended_offer',
        ...result.rows.map((row) =>
          [row.prospect_id, row.priority, row.confidence, csvCell(row.recommended_offer)].join(',')
        )
      ].join('\n'),
      refused: false
    };
  }

  private async requireSession(id: string, organizationId: string): Promise<ChatSession | null> {
    const result = await this.database.query<ChatSession>(
      `select * from ai_chat_sessions where id = $1 and organization_id = $2`,
      [id, organizationId]
    );

    return result.rows[0] ?? null;
  }

  private async insertMessage(input: {
    sessionId: string;
    organizationId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    intent: string;
    citations: ChatCitation[];
    resultCsv: string | null;
  }): Promise<ChatMessage> {
    const result = await this.database.query<ChatMessage>(
      `
      insert into ai_chat_messages (
        id,
        session_id,
        organization_id,
        user_id,
        role,
        content,
        intent,
        citations,
        result_csv
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      returning *
      `,
      [
        randomUUID(),
        input.sessionId,
        input.organizationId,
        input.userId,
        input.role,
        input.content,
        input.intent,
        JSON.stringify(input.citations),
        input.resultCsv
      ]
    );

    return normalizeMessage(requireRow(result.rows[0], 'Chat message was not created'));
  }

  private async touchSession(sessionId: string): Promise<void> {
    await this.database.query(`update ai_chat_sessions set updated_at = now() where id = $1`, [
      sessionId
    ]);
  }

  private async logChatRequest(
    organizationId: string,
    userId: string,
    sessionId: string,
    intent: string
  ): Promise<void> {
    await this.database.query(
      `
      insert into crm_activity_log (
        id,
        organization_id,
        user_id,
        action_type,
        new_value,
        metadata
      )
      values ($1, $2, $3, 'ai_chat_query', $4, $5::jsonb)
      `,
      [randomUUID(), organizationId, userId, intent, JSON.stringify({ sessionId })]
    );
  }
}

function normalizeQuestion(question: string): string {
  return question
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isMutationRequest(question: string): boolean {
  return ['supprime', 'efface', 'delete', 'modifie', 'change le statut', 'envoie', 'send'].some(
    (keyword) => question.includes(keyword)
  );
}

function extractScoreThreshold(question: string): number | null {
  const match = question.match(/score\s*(?:superieur|>|plus de|au-dessus de)?\s*(\d{1,3})/);
  if (!match?.[1]) return null;
  const score = Number(match[1]);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;
}

function extractCity(question: string): string | null {
  const knownCities = ['toulouse', 'albi', 'paris', 'lyon', 'bordeaux', 'marseille'];
  return knownCities.find((city) => question.includes(city)) ?? null;
}

function toCitation(prospect: ChatProspectRow, source: string): ChatCitation {
  return {
    prospectId: prospect.id,
    prospect: prospect.display_name,
    score: prospect.score,
    status: prospect.status,
    city: prospect.city,
    lastAction: prospect.last_action,
    source
  };
}

function toProspectCard(prospect: ChatProspectRow): ChatProspectCard {
  return {
    id: prospect.id,
    displayName: prospect.display_name,
    score: prospect.score,
    scoreLabel: prospect.score_label,
    status: prospect.status,
    city: prospect.city,
    platform: detectPlatform(prospect),
    lastAction: prospect.last_action
  };
}

function detectPlatform(prospect: ChatProspectRow): string | null {
  if (prospect.mym) return 'MYM';
  if (prospect.onlyfans) return 'OnlyFans';
  if (prospect.instagram) return 'Instagram';
  if (prospect.twitter_x) return 'X';
  if (prospect.linktree) return 'Linktree';
  if (prospect.allmylinks) return 'AllMyLinks';
  if (prospect.website) return 'Site web';
  return null;
}

function prospectsToCsv(prospects: ChatProspectRow[]): string {
  return [
    'id,prospect,score,score_label,status,city,email,phone,platform,last_action',
    ...prospects.map((prospect) =>
      [
        prospect.id,
        csvCell(prospect.display_name),
        prospect.score,
        prospect.score_label,
        prospect.status,
        csvCell(prospect.city ?? ''),
        csvCell(prospect.email ?? ''),
        csvCell(prospect.phone ?? ''),
        csvCell(detectPlatform(prospect) ?? ''),
        csvCell(prospect.last_action ?? '')
      ].join(',')
    )
  ].join('\n');
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    citations: Array.isArray(message.citations) ? message.citations : []
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function requireRow<T>(row: T | undefined, message: string): T {
  if (!row) throw new Error(message);

  return row;
}
