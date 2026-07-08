import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import {
  calculateQualityScores,
  ChatbotRuntimeCache,
  ChatbotRuntimeService
} from '../src/modules/chatbot-runtime/chatbot-runtime-service.js';
import { ChatbotProductionService } from '../src/modules/chatbot-production/chatbot-production-service.js';

const ORG = '00000000-0000-4000-8000-0000000000a1';
const SITE = '00000000-0000-4000-8000-000000000101';
const CONVERSATION = '00000000-0000-4000-8000-000000000201';
const MESSAGE = '00000000-0000-4000-8000-000000000301';

describe('chatbot runtime optimization', () => {
  it('caches and invalidates short-lived chatbot runtime values', async () => {
    const cache = new ChatbotRuntimeCache(1000);
    let calls = 0;

    const first = await cache.getOrSet('site:a:intents', ['site:a', 'intents'], async () => {
      calls += 1;
      return ['reservation'];
    });
    const second = await cache.getOrSet('site:a:intents', ['site:a', 'intents'], async () => {
      calls += 1;
      return ['other'];
    });
    const removed = cache.invalidate(['site:a']);
    const third = await cache.getOrSet('site:a:intents', ['site:a', 'intents'], async () => {
      calls += 1;
      return ['after-invalidation'];
    });

    assert.deepEqual(first, ['reservation']);
    assert.deepEqual(second, ['reservation']);
    assert.deepEqual(third, ['after-invalidation']);
    assert.equal(calls, 2);
    assert.equal(removed, 1);
    assert.deepEqual(cache.snapshot(), { hits: 1, misses: 2 });
  });

  it('calculates response quality scoring from reasoning signals', () => {
    const scores = calculateQualityScores({
      confidenceScore: 0.82,
      intentConfidence: 0.78,
      knowledgeMatched: true,
      goalAligned: true,
      nextBestAction: 'capture_lead',
      leadReadinessScore: 72
    });

    assert.equal(scores.knowledge_match_score, 1);
    assert.equal(scores.goal_alignment_score, 1);
    assert.equal(scores.lead_action_score, 1);
    assert.ok(scores.response_quality_score > 0.85);
  });

  it('records runtime metrics, widget diagnostics and review queue entries', async () => {
    const database = fakeRuntimeDatabase();
    const runtime = new ChatbotRuntimeService(database);

    await runtime.recordMetrics({
      organizationId: ORG,
      siteId: SITE,
      conversationId: CONVERSATION,
      messageId: MESSAGE,
      totalTimeMs: 120,
      knowledgeTimeMs: 20,
      reasoningTimeMs: 30,
      payloadBytes: 80,
      responseBytes: 240,
      cache: { hits: 2, misses: 1 }
    });
    await runtime.recordWidgetEvent({
      organizationId: ORG,
      siteId: SITE,
      conversationId: CONVERSATION,
      eventType: 'script_loaded',
      publicKey: 'public-key',
      sourceUrl: 'https://chambres-dhotes-albi.com/demo',
      debugEnabled: true
    });
    await runtime.enqueueReview({
      organizationId: ORG,
      siteId: SITE,
      conversationId: CONVERSATION,
      messageId: MESSAGE,
      reason: 'low_confidence',
      confidenceScore: 0.31,
      leadReadinessScore: 80,
      nextBestAction: 'escalate_to_admin',
      question: 'Question inconnue'
    });

    const diagnostics = await runtime.diagnostics({
      organizationId: ORG,
      site: {
        id: SITE,
        organization_id: ORG,
        name: 'Demo',
        slug: 'demo',
        widget_public_key: 'public-key',
        activity: 'demo',
        business_config_id: 'default',
        status: 'active',
        widget_enabled: true,
        domain: 'chambres-dhotes-albi.com',
        allowed_domains: ['chambres-dhotes-albi.com'],
        widget_primary_color: null,
        widget_welcome_message: null,
        widget_fallback_message: null,
        widget_privacy_message: null,
        lead_capture_enabled: true,
        lead_capture_trigger: 'after_messages',
        lead_capture_after_messages: 3,
        lead_capture_fields: ['email']
      }
    });
    const queue = await runtime.listReviewQueue({ organizationId: ORG, siteId: SITE });

    assert.equal(database.metrics.length, 1);
    assert.equal(database.events.length, 1);
    assert.equal(queue.length, 1);
    assert.equal(diagnostics.scriptStatus, 'active');
    assert.equal(diagnostics.conversationsCreated, 1);
  });

  it('keeps widget domain validation strict for real integrations', () => {
    const production = new ChatbotProductionService(fakeRuntimeDatabase());
    const site = { allowed_domains: ['chambres-dhotes-albi.com'] };

    assert.doesNotThrow(() =>
      production.assertDomainAllowed(site, 'https://www.chambres-dhotes-albi.com/page')
    );
    assert.throws(
      () => production.assertDomainAllowed(site, 'https://unknown.example/page'),
      /Widget domain is not allowed/
    );
  });
});

function fakeRuntimeDatabase() {
  const metrics: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const reviews: Array<Record<string, unknown>> = [];
  const database: Database & {
    metrics: Array<Record<string, unknown>>;
    events: Array<Record<string, unknown>>;
    reviews: Array<Record<string, unknown>>;
  } = {
    metrics,
    events,
    reviews,
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (sql.startsWith('insert into chatbot_runtime_metrics')) {
        metrics.push({ organization_id: values[1], site_id: values[2], total_time_ms: values[5] });
        return result<T>([]);
      }
      if (sql.startsWith('insert into widget_runtime_events')) {
        events.push({
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          event_type: values[4],
          source_url: values[6],
          debug_enabled: values[9],
          created_at: new Date()
        });
        return result<T>([]);
      }
      if (sql.startsWith('insert into chatbot_review_queue')) {
        reviews.push({
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          conversation_id: values[3],
          message_id: values[4],
          reason: values[5],
          confidence_score: values[6],
          lead_readiness_score: values[7],
          next_best_action: values[8],
          question: values[9],
          status: 'pending',
          created_at: new Date()
        });
        return result<T>([]);
      }
      if (sql.startsWith('select * from widget_runtime_events')) {
        return result<T>(events);
      }
      if (sql.startsWith('select count(*)::text as count from conversations')) {
        return result<T>([{ count: '1' }]);
      }
      if (sql.startsWith('select count(*)::int as samples')) {
        return result<T>([
          {
            samples: 1,
            average_response_ms: 120,
            average_knowledge_ms: 20,
            average_reasoning_ms: 30,
            average_db_ms: 0,
            average_payload_bytes: 80,
            errors: 0
          }
        ]);
      }
      if (sql.startsWith('select q.*')) {
        return result<T>(reviews);
      }
      if (sql.startsWith('update chatbot_review_queue')) {
        return result<T>(reviews.slice(0, 1));
      }
      if (sql.startsWith('select site_id')) {
        return result<T>([]);
      }

      return result<T>([]);
    }
  };
  return database;
}

function result<T extends pg.QueryResultRow = pg.QueryResultRow>(
  rows: Array<Record<string, unknown>>
): pg.QueryResult<T> {
  return {
    rows: rows as T[],
    command: '',
    rowCount: rows.length,
    oid: 0,
    fields: []
  };
}
