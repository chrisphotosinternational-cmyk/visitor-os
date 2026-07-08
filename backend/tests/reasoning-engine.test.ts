import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { ReasoningEngineService } from '../src/modules/reasoning/reasoning-engine-service.js';

const ORG = '00000000-0000-4000-8000-0000000000a1';
const SITE = '00000000-0000-4000-8000-000000000101';
const CONVERSATION = '00000000-0000-4000-8000-000000000201';
const VISITOR = '00000000-0000-4000-8000-000000000301';
const MESSAGE = '00000000-0000-4000-8000-000000000401';

describe('Reasoning Engine', () => {
  it('detects intent, applies reservation goal and stores context plus trace', async () => {
    const database = fakeReasoningDatabase();
    const reasoning = new ReasoningEngineService(database);

    const result = await reasoning.reason({
      organizationId: ORG,
      siteId: SITE,
      visitorId: VISITOR,
      conversationId: CONVERSATION,
      messageId: MESSAGE,
      userMessage: 'Avez-vous des disponibilites demain pour reserver ?',
      conversationHistory: [{ senderType: 'visitor', content: 'Bonjour' }]
    });
    const context = await reasoning.getContext(ORG, CONVERSATION);
    const traces = await reasoning.listTraces(ORG, CONVERSATION);

    assert.equal(result.detected_intent, 'Disponibilites');
    assert.equal(result.applied_goal, 'reservation');
    assert.equal(result.next_best_action, 'suggest_cta');
    assert.equal(result.lead_capture_recommended, false);
    assert.equal(context?.lead_readiness_score, 60);
    assert.equal(traces.length, 1);
  });

  it('adapts response to personality and chooses create_prospect for hot leads', async () => {
    const database = fakeReasoningDatabase({ leadReadinessScore: 70 });
    const reasoning = new ReasoningEngineService(database);

    const result = await reasoning.reason({
      organizationId: ORG,
      siteId: SITE,
      visitorId: VISITOR,
      conversationId: CONVERSATION,
      userMessage: 'Voici mon email test@example.com, je veux un devis urgent.'
    });

    assert.equal(result.next_best_action, 'create_prospect');
    assert.equal(result.lead_readiness_score, 100);
    assert.match(result.response_text, /sans engagement|devis/i);
    assert.ok(result.applied_personality?.includes('rassurant'));
  });

  it('records low confidence conversations for admin review', async () => {
    const database = fakeReasoningDatabase({ noKnowledge: true, noIntents: true });
    const reasoning = new ReasoningEngineService(database);

    const result = await reasoning.reason({
      organizationId: ORG,
      siteId: SITE,
      visitorId: VISITOR,
      conversationId: CONVERSATION,
      userMessage: 'blorb zintrop'
    });

    assert.equal(result.next_best_action, 'escalate_to_admin');
    assert.equal(database.updatedConversationStatus, 'in_review');
  });
});

function fakeReasoningDatabase(
  options: { leadReadinessScore?: number; noKnowledge?: boolean; noIntents?: boolean } = {}
) {
  const context: Record<string, unknown> = {
    id: 'context-1',
    organization_id: ORG,
    site_id: SITE,
    conversation_id: CONVERSATION,
    visitor_id: VISITOR,
    previous_intents: [],
    lead_readiness_score: options.leadReadinessScore ?? 0
  };
  const traces: Array<Record<string, unknown>> = [];
  const database: Database & { updatedConversationStatus?: string } = {
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (sql.startsWith('select * from visitor_conversation_context')) {
        return result<T>([context]);
      }

      if (sql.startsWith('insert into visitor_conversation_context')) {
        return result<T>([context]);
      }

      if (sql.startsWith('update visitor_conversation_context')) {
        context.detected_needs = values[2];
        context.detected_city = values[3];
        context.detected_service = values[4];
        context.detected_budget = values[5];
        context.detected_urgency = values[6];
        context.detected_contact_intent = values[7];
        context.previous_intents = values[8];
        context.lead_readiness_score = values[9];
        return result<T>([context]);
      }

      if (sql.startsWith('select * from chatbot_personality')) {
        return result<T>([
          {
            tone: 'rassurant',
            style: 'premium',
            answer_length: 'medium',
            formality: 'vouvoiement',
            emoji_level: 'none',
            commercial_intensity: 80,
            reassurance_level: 90
          }
        ]);
      }

      if (sql.startsWith('select * from chatbot_goals')) {
        return result<T>([
          {
            goal_type: 'reservation',
            description: 'Orienter vers une reservation',
            priority: 90,
            success_action: 'Proposer une reservation'
          },
          {
            goal_type: 'devis',
            description: 'Qualifier une demande de devis',
            priority: 70,
            success_action: 'Preparer un devis'
          }
        ]);
      }

      if (sql.startsWith('select * from conversation_flows')) {
        return result<T>([{ name: 'Capture douce' }]);
      }

      if (
        sql.startsWith(
          'select id, name, slug, category, examples, synonyms, priority from chatbot_intents'
        )
      ) {
        return result<T>(
          options.noIntents
            ? []
            : [
                {
                  id: 'intent-1',
                  name: 'Disponibilites',
                  slug: 'disponibilites',
                  category: 'reservation',
                  examples: ['Avez-vous une date disponible ?'],
                  synonyms: ['disponibilite', 'reservation', 'date'],
                  priority: 90
                }
              ]
        );
      }

      if (sql.startsWith('select k.id')) {
        return result<T>(
          options.noKnowledge
            ? []
            : [
                {
                  id: 'knowledge-1',
                  title: 'Disponibilites',
                  main_question: 'Avez-vous des disponibilites ?',
                  alternative_questions: ['Puis-je reserver ?'],
                  short_answer: 'Oui, nous pouvons verifier les disponibilites.',
                  detailed_answer: null,
                  commercial_answer: null,
                  reassurance_answer: null,
                  tags: ['reservation', 'date'],
                  priority: 80,
                  cta_label: 'Reserver',
                  intent_name: 'Disponibilites',
                  intent_synonyms: ['reservation']
                }
              ]
        );
      }

      if (sql.startsWith('insert into reasoning_traces')) {
        traces.push({
          id: values[0],
          organization_id: values[1],
          site_id: values[2],
          conversation_id: values[3],
          message_id: values[4],
          detected_intent: values[5],
          intent_confidence: values[6],
          selected_knowledge_item_id: values[7],
          applied_goal: values[8],
          applied_personality: values[9],
          next_best_action: values[10],
          confidence_score: values[11],
          trace_json: values[12]
        });
        return result<T>([]);
      }

      if (sql.startsWith('select * from reasoning_traces')) return result<T>(traces);

      if (sql.startsWith('update conversations')) {
        database.updatedConversationStatus = 'in_review';
        return result<T>([]);
      }

      if (sql.startsWith('select count')) {
        return result<T>([{ lead_readiness_over_60: 0, lead_readiness_over_80: 0 }]);
      }

      if (sql.startsWith('select detected_intent') || sql.startsWith('select next_best_action')) {
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
