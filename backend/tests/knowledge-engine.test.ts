import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { KnowledgeEngineService } from '../src/modules/knowledge-engine/knowledge-engine-service.js';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const SITE_A = '00000000-0000-4000-8000-000000000101';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const SITE_B = '00000000-0000-4000-8000-000000000201';
const USER_A = '00000000-0000-4000-8000-0000000000f1';
const INTENT_A = '00000000-0000-4000-8000-00000000i101';
const KNOWLEDGE_A = '00000000-0000-4000-8000-00000000k101';
const UNANSWERED_A = '00000000-0000-4000-8000-00000000u101';
const SUGGESTION_A = '00000000-0000-4000-8000-00000000s101';
const FLOW_A = '00000000-0000-4000-8000-00000000f101';

describe('Knowledge Engine administration', () => {
  it('creates, lists and updates chatbot intents', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);

    const intent = await service.createIntent(ORG_A, SITE_A, {
      name: 'Reservation',
      examples: ['Je veux reserver'],
      synonyms: ['booking'],
      priority: 80
    });
    const updated = await service.updateIntent(String(intent.id), ORG_A, { category: 'commerce' });
    const intents = await service.listIntents({ organizationId: ORG_A, siteId: SITE_A });

    assert.equal(intent.slug, 'reservation');
    assert.equal(updated?.category, 'commerce');
    assert.equal(intents.length, 1);
  });

  it('answers from active knowledge items before legacy Q/A', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.createKnowledge(ORG_A, SITE_A, {
      title: 'Parking',
      mainQuestion: 'Avez-vous un parking ?',
      shortAnswer: 'Oui, parking prive sur demande.',
      tags: ['parking', 'acces'],
      status: 'active',
      userId: USER_A
    });

    const answer = await service.answerQuestion({
      organizationId: ORG_A,
      siteId: SITE_A,
      question: 'Avez-vous un parking ?'
    });

    assert.equal(answer?.source, 'knowledge_engine');
    assert.equal(answer?.reply, 'Oui, parking prive sur demande.');
    assert.ok((answer?.confidence ?? 0) > 0.5);
  });

  it('records unknown questions and accepts suggestions into knowledge items', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Les arrivées tardives sont possibles ?',
      detectedIntent: 'arrival',
      confidenceScore: 0.32
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);
    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A);

    assert.equal(suggestion.status, 'pending');
    assert.equal(accepted.suggestion.status, 'accepted');
    assert.equal(accepted.knowledge.status, 'draft');
    assert.equal(accepted.knowledge.site_id, SITE_A);
  });

  it('accepts suggestions with edited draft content without auto-publishing', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Question originale ?',
      detectedIntent: 'arrival'
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);

    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, {
      title: 'Titre edite',
      mainQuestion: 'Question editee ?',
      shortAnswer: 'Reponse editee.',
      tags: ['edited'],
      priority: 90,
      status: 'draft'
    });

    assert.equal(accepted.suggestion.status, 'accepted');
    assert.equal(accepted.knowledge.title, 'Titre edite');
    assert.equal(accepted.knowledge.main_question, 'Question editee ?');
    assert.equal(accepted.knowledge.short_answer, 'Reponse editee.');
    assert.deepEqual(accepted.knowledge.tags, ['edited']);
    assert.equal(accepted.knowledge.priority, 90);
    assert.equal(accepted.knowledge.status, 'draft');
  });

  it('accepts suggestions as needs_review but rejects active without creating knowledge', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Besoin de validation ?',
      detectedIntent: 'review'
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);

    const needsReview = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, {
      status: 'needs_review'
    });
    assert.equal(needsReview.knowledge.status, 'needs_review');

    const before = await service.listKnowledge({ organizationId: ORG_A, siteId: SITE_A });
    await assert.rejects(
      service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, { status: 'active' }),
      { name: 'AppError', statusCode: 400 }
    );
    const after = await service.listKnowledge({ organizationId: ORG_A, siteId: SITE_A });
    assert.equal(after.length, before.length);
  });

  it('keeps publication separate from suggestion acceptance', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Publier separement ?',
      detectedIntent: 'publish'
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);
    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A);

    assert.equal(accepted.knowledge.status, 'draft');
    const published = await service.setKnowledgeStatus(
      String(accepted.knowledge.id),
      ORG_A,
      'active',
      USER_A
    );
    assert.equal(published?.status, 'active');
  });

  it('isolates suggestions by organization and keeps the suggestion site', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Site source ?',
      detectedIntent: 'tenant'
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);

    await assert.rejects(service.acceptSuggestion(String(suggestion.id), ORG_B, USER_A), {
      name: 'AppError',
      statusCode: 404
    });
    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, {
      title: 'Ignore body site',
      siteId: SITE_B
    } as never);

    assert.equal(accepted.knowledge.organization_id, ORG_A);
    assert.equal(accepted.knowledge.site_id, SITE_A);
  });

  it('manages personality, goals and simple conversation flows', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    const personality = await service.savePersonality(ORG_A, SITE_A, {
      tone: 'premium',
      answerLength: 'medium',
      formality: 'vouvoiement',
      emojiLevel: 'none',
      commercialIntensity: 55,
      reassuranceLevel: 85
    });
    const goal = await service.createGoal(ORG_A, SITE_A, {
      goalType: 'reservation',
      description: 'Transformer une conversation chaude en demande de reservation.',
      priority: 90
    });
    const flow = await service.createFlow(ORG_A, SITE_A, {
      name: 'Qualification reservation',
      description: 'Collecter dates et besoin.'
    });
    const step = await service.addFlowStep({
      flowId: String(flow.id),
      stepOrder: 1,
      stepType: 'question',
      content: 'Pour quelles dates souhaitez-vous reserver ?',
      actionType: 'ask_question'
    });

    assert.equal(personality.tone, 'premium');
    assert.equal(goal.goal_type, 'reservation');
    assert.equal(flow.name, 'Qualification reservation');
    assert.equal(step.step_type, 'question');
  });
});

function fakeKnowledgeDatabase(): Database {
  const intents: Array<Record<string, unknown>> = [];
  const knowledge: Array<Record<string, unknown>> = [];
  const unanswered: Array<Record<string, unknown>> = [];
  const suggestions: Array<Record<string, unknown>> = [];
  const flows: Array<Record<string, unknown>> = [];

  return {
    isConfigured: () => true,
    checkConnection: () => Promise.resolve(),
    close: () => Promise.resolve(),
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (sql.startsWith('insert into chatbot_intents')) {
        const row = {
          id: INTENT_A,
          organization_id: values[1],
          site_id: values[2],
          name: values[3],
          slug: values[4],
          description: values[5],
          category: values[6],
          examples: values[7],
          synonyms: values[8],
          priority: values[9],
          is_active: values[10],
          created_at: new Date(),
          updated_at: new Date()
        };
        intents.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('update chatbot_intents')) {
        Object.assign(intents[0] ?? {}, { category: values[5], updated_at: new Date() });
        return result<T>(intents.slice(0, 1));
      }

      if (sql.startsWith('select * from chatbot_intents')) {
        return result<T>(intents);
      }

      if (sql.startsWith('insert into knowledge_items')) {
        const row = {
          id: knowledge.length === 0 ? KNOWLEDGE_A : values[0],
          organization_id: values[1],
          site_id: values[2],
          intent_id: values[3],
          title: values[4],
          main_question: values[5],
          alternative_questions: values[6],
          short_answer: values[7],
          detailed_answer: values[8],
          commercial_answer: values[9],
          reassurance_answer: values[10],
          links: values[11],
          cta_label: values[12],
          cta_url: values[13],
          conditions: values[14],
          tags: values[15],
          priority: values[16],
          status: values[17],
          version: 1,
          match_score: 100,
          created_at: new Date(),
          updated_at: new Date()
        };
        knowledge.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('select * from knowledge_items')) {
        return result<T>(
          knowledge.filter(
            (item) => item.organization_id === values[0] && item.site_id === values[1]
          )
        );
      }

      if (sql.startsWith('update knowledge_items')) {
        const row = knowledge.find(
          (item) => item.id === values[0] && item.organization_id === values[1]
        );
        if (!row) return result<T>([]);
        row.status = values[16] ?? row.status;
        row.updated_by_user_id = values[17] ?? row.updated_by_user_id;
        row.updated_at = new Date();
        return result<T>([row]);
      }

      if (sql.includes('from knowledge_items k')) {
        return result<T>(knowledge.filter((item) => item.status === 'active'));
      }

      if (sql.startsWith('insert into chatbot_unanswered_questions')) {
        const row = {
          id: UNANSWERED_A,
          organization_id: values[1],
          site_id: values[2],
          conversation_id: values[3],
          question: values[4],
          detected_intent: values[5],
          confidence_score: values[6],
          occurrence_count: 1,
          action_status: 'pending',
          status: 'pending',
          tags: [],
          created_at: new Date(),
          updated_at: new Date()
        };
        unanswered.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('select * from chatbot_unanswered_questions')) {
        return result<T>(unanswered);
      }

      if (sql.startsWith('insert into knowledge_suggestions')) {
        const row = {
          id: SUGGESTION_A,
          organization_id: values[1],
          site_id: values[2],
          source_type: 'unanswered_question',
          source_id: values[3],
          suggested_intent: values[4],
          suggested_question: values[5],
          suggested_answer: values[6],
          suggested_tags: values[7],
          confidence_score: values[8],
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        };
        suggestions.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('select * from knowledge_suggestions')) {
        return result<T>(
          suggestions.filter((row) => row.id === values[0] && row.organization_id === values[1])
        );
      }

      if (sql.startsWith('update knowledge_suggestions')) {
        const index = suggestions.findIndex(
          (row) => row.id === values[0] && row.organization_id === values[1]
        );
        if (index === -1) return result<T>([]);
        const updated = {
          ...suggestions[index],
          status: sql.includes('accepted') ? 'accepted' : 'rejected'
        };
        suggestions[index] = updated;
        return result<T>([updated]);
      }

      if (sql.startsWith('insert into chatbot_personality')) {
        return result<T>([
          { id: values[0], organization_id: values[1], site_id: values[2], tone: values[3] }
        ]);
      }

      if (sql.startsWith('insert into chatbot_goals')) {
        return result<T>([
          {
            id: values[0],
            organization_id: values[1],
            site_id: values[2],
            goal_type: values[3],
            description: values[4],
            priority: values[5]
          }
        ]);
      }

      if (sql.startsWith('insert into conversation_flows')) {
        const row = {
          id: FLOW_A,
          organization_id: values[1],
          site_id: values[2],
          name: values[3],
          description: values[4],
          is_active: values[6]
        };
        flows.push(row);
        return result<T>([row]);
      }

      if (sql.startsWith('insert into conversation_flow_steps')) {
        return result<T>([
          {
            id: values[0],
            flow_id: values[1],
            step_order: values[2],
            step_type: values[3],
            content: values[4],
            action_type: values[7]
          }
        ]);
      }

      return result<T>([]);
    }
  };
}

function result<T extends pg.QueryResultRow>(rows: unknown[]): pg.QueryResult<T> {
  return {
    rows: rows as T[],
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: []
  };
}
