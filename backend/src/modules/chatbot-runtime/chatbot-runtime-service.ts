import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { AppError } from '../../core/errors/app-error.js';
import type { SiteRecord } from '../conversations/conversation-repository.js';

export type RuntimeCacheSnapshot = {
  hits: number;
  misses: number;
};

export type RuntimeMetricsInput = {
  organizationId: string;
  siteId: string;
  conversationId?: string | null | undefined;
  messageId?: string | null | undefined;
  totalTimeMs: number;
  knowledgeTimeMs?: number | undefined;
  reasoningTimeMs?: number | undefined;
  dbTimeMs?: number | undefined;
  payloadBytes?: number | undefined;
  responseBytes?: number | undefined;
  cache?: RuntimeCacheSnapshot | undefined;
  errorCode?: string | null | undefined;
};

export type WidgetEventInput = {
  organizationId: string;
  siteId: string;
  conversationId?: string | null | undefined;
  eventType: 'script_loaded' | 'conversation_started' | 'message_sent' | 'lead_sent' | 'error';
  publicKey?: string | undefined;
  sourceUrl?: string | undefined;
  userAgent?: string | undefined;
  debugEnabled?: boolean | undefined;
  message?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type QualityScoreInput = {
  confidenceScore: number;
  intentConfidence: number;
  knowledgeMatched: boolean;
  goalAligned: boolean;
  nextBestAction: string;
  leadReadinessScore: number;
};

export type QualityScores = {
  confidence_score: number;
  intent_confidence: number;
  knowledge_match_score: number;
  goal_alignment_score: number;
  lead_action_score: number;
  response_quality_score: number;
};

export class ChatbotRuntimeCache {
  private readonly values = new Map<
    string,
    { expiresAt: number; tags: string[]; value: unknown }
  >();
  private hits = 0;
  private misses = 0;

  constructor(private readonly ttlMs = 30_000) {}

  async getOrSet<T>(key: string, tags: string[], producer: () => Promise<T>): Promise<T> {
    const current = this.values.get(key);
    if (current && current.expiresAt > Date.now()) {
      this.hits += 1;
      return current.value as T;
    }

    this.misses += 1;
    const value = await producer();
    this.values.set(key, { expiresAt: Date.now() + this.ttlMs, tags, value });
    return value;
  }

  invalidate(tags: string[]): number {
    let removed = 0;
    for (const [key, entry] of this.values.entries()) {
      if (entry.tags.some((tag) => tags.includes(tag))) {
        this.values.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  snapshot(): RuntimeCacheSnapshot {
    return { hits: this.hits, misses: this.misses };
  }
}

export class ChatbotRuntimeService {
  constructor(private readonly database: Database) {}

  async recordMetrics(input: RuntimeMetricsInput): Promise<void> {
    await this.database.query(
      `
      insert into chatbot_runtime_metrics (
        id, organization_id, site_id, conversation_id, message_id,
        total_time_ms, knowledge_time_ms, reasoning_time_ms, db_time_ms,
        payload_bytes, response_bytes, cache_hits, cache_misses, error_code
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.conversationId ?? null,
        input.messageId ?? null,
        Math.max(0, Math.round(input.totalTimeMs)),
        Math.max(0, Math.round(input.knowledgeTimeMs ?? 0)),
        Math.max(0, Math.round(input.reasoningTimeMs ?? 0)),
        Math.max(0, Math.round(input.dbTimeMs ?? 0)),
        Math.max(0, Math.round(input.payloadBytes ?? 0)),
        Math.max(0, Math.round(input.responseBytes ?? 0)),
        input.cache?.hits ?? 0,
        input.cache?.misses ?? 0,
        input.errorCode ?? null
      ]
    );
  }

  async recordWidgetEvent(input: WidgetEventInput): Promise<void> {
    await this.database.query(
      `
      insert into widget_runtime_events (
        id, organization_id, site_id, conversation_id, event_type, public_key,
        source_url, domain, user_agent, debug_enabled, message, metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.conversationId ?? null,
        input.eventType,
        input.publicKey ?? null,
        input.sourceUrl ?? null,
        domainFromUrl(input.sourceUrl),
        input.userAgent ?? null,
        input.debugEnabled ?? false,
        input.message ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    );
  }

  async diagnostics(input: {
    organizationId: string;
    site: SiteRecord;
  }): Promise<Record<string, unknown>> {
    const [lastLoad, lastErrors, conversations, metrics] = await Promise.all([
      this.database.query<Record<string, unknown>>(
        `
        select *
        from widget_runtime_events
        where organization_id = $1 and site_id = $2 and event_type = 'script_loaded'
        order by created_at desc
        limit 1
        `,
        [input.organizationId, input.site.id]
      ),
      this.database.query<Record<string, unknown>>(
        `
        select *
        from widget_runtime_events
        where organization_id = $1 and site_id = $2 and event_type = 'error'
        order by created_at desc
        limit 10
        `,
        [input.organizationId, input.site.id]
      ),
      this.database.query<{ count: string }>(
        `select count(*)::text as count from conversations where organization_id = $1 and site_id = $2`,
        [input.organizationId, input.site.id]
      ),
      this.siteRuntimeMetrics(input.organizationId, input.site.id)
    ]);

    return {
      scriptStatus:
        input.site.status === 'active' && input.site.widget_enabled ? 'active' : 'inactive',
      allowedDomains: input.site.allowed_domains ?? [],
      lastWidgetLoad: lastLoad.rows[0] ?? null,
      recentErrors: lastErrors.rows,
      widgetVersion: 'runtime-v21',
      apiConnection: 'ok',
      conversationsCreated: Number(conversations.rows[0]?.count ?? 0),
      metrics
    };
  }

  async siteRuntimeMetrics(
    organizationId: string,
    siteId: string
  ): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        count(*)::int as samples,
        coalesce(round(avg(total_time_ms)::numeric, 1), 0)::float as average_response_ms,
        coalesce(round(avg(knowledge_time_ms)::numeric, 1), 0)::float as average_knowledge_ms,
        coalesce(round(avg(reasoning_time_ms)::numeric, 1), 0)::float as average_reasoning_ms,
        coalesce(round(avg(db_time_ms)::numeric, 1), 0)::float as average_db_ms,
        coalesce(round(avg(payload_bytes)::numeric, 1), 0)::float as average_payload_bytes,
        count(*) filter (where error_code is not null)::int as errors
      from chatbot_runtime_metrics
      where organization_id = $1 and site_id = $2 and created_at >= now() - interval '7 days'
      `,
      [organizationId, siteId]
    );
    return result.rows[0] ?? {};
  }

  async organizationMetrics(organizationId: string): Promise<Record<string, unknown>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        site_id,
        count(*)::int as samples,
        coalesce(round(avg(total_time_ms)::numeric, 1), 0)::float as average_response_ms,
        coalesce(round(avg(response_quality_score)::numeric, 3), 0)::float as average_quality_score
      from (
        select m.*, t.response_quality_score
        from chatbot_runtime_metrics m
        left join reasoning_traces t on t.message_id = m.message_id
        where m.organization_id = $1 and m.created_at >= now() - interval '7 days'
      ) runtime
      group by site_id
      order by average_response_ms desc
      limit 20
      `,
      [organizationId]
    );
    return { bySite: result.rows };
  }

  async enqueueReview(input: {
    organizationId: string;
    siteId: string;
    conversationId: string;
    messageId?: string | null | undefined;
    reason: string;
    confidenceScore?: number | null | undefined;
    leadReadinessScore?: number | null | undefined;
    nextBestAction?: string | null | undefined;
    question?: string | undefined;
  }): Promise<void> {
    await this.database.query(
      `
      insert into chatbot_review_queue (
        id, organization_id, site_id, conversation_id, message_id, reason,
        confidence_score, lead_readiness_score, next_best_action, question
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        input.conversationId,
        input.messageId ?? null,
        input.reason,
        input.confidenceScore ?? null,
        input.leadReadinessScore ?? null,
        input.nextBestAction ?? null,
        input.question ?? null
      ]
    );
  }

  async listReviewQueue(input: {
    organizationId: string;
    siteId: string;
    status?: string | undefined;
  }): Promise<Array<Record<string, unknown>>> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      select
        q.*,
        c.status as conversation_status,
        p.display_name as prospect_name
      from chatbot_review_queue q
      left join conversations c on c.id = q.conversation_id
      left join prospects p on p.id = c.prospect_id
      where q.organization_id = $1
        and q.site_id = $2
        and ($3::text is null or q.status = $3)
      order by q.created_at desc
      limit 200
      `,
      [input.organizationId, input.siteId, input.status ?? null]
    );
    return result.rows;
  }

  async resolveReview(input: {
    organizationId: string;
    siteId: string;
    reviewId: string;
    status: 'ignored' | 'fixed';
    adminNote?: string | undefined;
    userId?: string | undefined;
  }): Promise<Record<string, unknown> | null> {
    const result = await this.database.query<Record<string, unknown>>(
      `
      update chatbot_review_queue
      set status = $1,
          admin_note = $2,
          resolved_by_user_id = $3,
          resolved_at = now(),
          updated_at = now()
      where id = $4 and organization_id = $5 and site_id = $6
      returning *
      `,
      [
        input.status,
        input.adminNote ?? null,
        input.userId ?? null,
        input.reviewId,
        input.organizationId,
        input.siteId
      ]
    );
    return result.rows[0] ?? null;
  }
}

export function calculateQualityScores(input: QualityScoreInput): QualityScores {
  const knowledge = input.knowledgeMatched ? 1 : input.confidenceScore >= 0.65 ? 0.65 : 0.25;
  const goal = input.goalAligned ? 1 : 0.45;
  const leadAction = leadActionScore(input.nextBestAction, input.leadReadinessScore);
  const quality =
    input.confidenceScore * 0.35 +
    input.intentConfidence * 0.25 +
    knowledge * 0.2 +
    goal * 0.1 +
    leadAction * 0.1;

  return {
    confidence_score: round(input.confidenceScore),
    intent_confidence: round(input.intentConfidence),
    knowledge_match_score: round(knowledge),
    goal_alignment_score: round(goal),
    lead_action_score: round(leadAction),
    response_quality_score: round(quality)
  };
}

function leadActionScore(action: string, score: number): number {
  if (score >= 80) return action === 'create_prospect' ? 1 : 0.35;
  if (score >= 60) return ['capture_lead', 'create_prospect'].includes(action) ? 1 : 0.45;
  if (action === 'escalate_to_admin') return 0.55;
  return 0.8;
}

function domainFromUrl(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return (
      value
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        ?.toLowerCase() ?? null
    );
  }
}

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
}

export function assertReviewStatus(status: string): 'ignored' | 'fixed' {
  if (status === 'ignored' || status === 'fixed') return status;
  throw new AppError('Invalid review status', {
    statusCode: 400,
    code: 'INVALID_REVIEW_STATUS'
  });
}
