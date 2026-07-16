import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { KnowledgeEngineService } from '../src/modules/knowledge-engine/knowledge-engine-service.js';

const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';
const SITE_A = '00000000-0000-4000-8000-000000000101';
const SITE_B = '00000000-0000-4000-8000-000000000102';
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

  it('records unknown questions and accepts edited suggestions into draft knowledge items', async () => {
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
    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, {
      title: 'Arrivées tardives',
      mainQuestion: 'Peut-on arriver tard ?',
      alternativeQuestions: ['Les arrivées tardives sont possibles ?'],
      shortAnswer: 'Oui, les arrivées tardives sont possibles sur demande.',
      detailedAnswer: 'Prévenez-nous avant votre arrivée pour organiser l’accès.',
      commercialAnswer: 'Nous nous adaptons à votre horaire pour faciliter votre séjour.',
      reassuranceAnswer: 'Votre arrivée reste simple même en soirée.',
      tags: ['arrival', 'late-checkin'],
      intentId: INTENT_A,
      status: 'draft'
    });

    assert.equal(suggestion.status, 'pending');
    assert.equal(accepted.suggestion.status, 'accepted');
    assert.equal(accepted.knowledge.status, 'draft');
    assert.equal(accepted.knowledge.title, 'Arrivées tardives');
    assert.equal(accepted.knowledge.main_question, 'Peut-on arriver tard ?');
    assert.deepEqual(accepted.knowledge.alternative_questions, [
      'Les arrivées tardives sont possibles ?'
    ]);
    assert.equal(
      accepted.knowledge.short_answer,
      'Oui, les arrivées tardives sont possibles sur demande.'
    );
    assert.equal(
      accepted.knowledge.detailed_answer,
      'Prévenez-nous avant votre arrivée pour organiser l’accès.'
    );
    assert.equal(
      accepted.knowledge.commercial_answer,
      'Nous nous adaptons à votre horaire pour faciliter votre séjour.'
    );
    assert.equal(
      accepted.knowledge.reassurance_answer,
      'Votre arrivée reste simple même en soirée.'
    );
    assert.deepEqual(accepted.knowledge.tags, ['arrival', 'late-checkin']);
    assert.equal(accepted.knowledge.intent_id, INTENT_A);
  });

  it('keeps suggestion acceptance in draft by default and publishes only through knowledge status updates', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Puis-je venir avec un chien ?',
      detectedIntent: 'pet',
      confidenceScore: 0.28
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

  it('accepts suggestions into needs_review without automatic publication', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Avez-vous une borne électrique ?',
      confidenceScore: 0.31
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);
    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, {
      status: 'needs_review'
    });

    assert.equal(accepted.knowledge.status, 'needs_review');
  });

  it('rejects suggestions without creating knowledge items', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Question hors périmètre',
      confidenceScore: 0.2
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);
    const rejected = await service.rejectSuggestion(String(suggestion.id), ORG_A);
    const answer = await service.answerQuestion({
      organizationId: ORG_A,
      siteId: SITE_A,
      question: 'Question hors périmètre'
    });

    assert.equal(rejected?.status, 'rejected');
    assert.equal(answer, null);
  });

  it('keeps suggestion acceptance isolated by organization and site', async () => {
    const database = fakeKnowledgeDatabase();
    const service = new KnowledgeEngineService(database);
    await service.enhancedUnanswered({
      organizationId: ORG_A,
      siteId: SITE_A,
      conversationId: '00000000-0000-4000-8000-00000000c101',
      question: 'Proposez-vous le petit déjeuner ?',
      confidenceScore: 0.33
    });
    const suggestion = await service.generateSuggestion(UNANSWERED_A, ORG_A);

    await assert.rejects(
      service.acceptSuggestion(String(suggestion.id), ORG_B, USER_A),
      /Suggestion not found/
    );
    await assert.rejects(
      service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, { expectedSiteId: SITE_B }),
      /Suggestion not found/
    );

    const accepted = await service.acceptSuggestion(String(suggestion.id), ORG_A, USER_A, {
      expectedSiteId: SITE_A
    });
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

      if (sql.includes('from knowledge_items k')) {
        return result<T>(knowledge.filter((item) => item.status === 'active'));
      }

      if (sql.startsWith('update knowledge_items')) {
        const item = knowledge.find(
          (current) => current.id === values[0] && current.organization_id === values[1]
        );
        if (!item) return result<T>([]);
        Object.assign(item, {
          intent_id: values[2] ?? item.intent_id,
          title: values[3] ?? item.title,
          main_question: values[4] ?? item.main_question,
          alternative_questions: values[5] ?? item.alternative_questions,
          short_answer: values[6] ?? item.short_answer,
          detailed_answer: values[7] ?? item.detailed_answer,
          commercial_answer: values[8] ?? item.commercial_answer,
          reassurance_answer: values[9] ?? item.reassurance_answer,
          links: values[10] ?? item.links,
          cta_label: values[11] ?? item.cta_label,
          cta_url: values[12] ?? item.cta_url,
          conditions: values[13] ?? item.conditions,
          tags: values[14] ?? item.tags,
          priority: values[15] ?? item.priority,
          status: values[16] ?? item.status,
          updated_by_user_id: values[17] ?? item.updated_by_user_id,
          updated_at: new Date()
        });
        return result<T>([item]);
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
          suggestions.filter(
            (suggestion) =>
              (values[0] === undefined || suggestion.id === values[0]) &&
              (values[1] === undefined || suggestion.organization_id === values[1])
          )
        );
      }

      if (sql.startsWith('update knowledge_suggestions')) {
        const index = suggestions.findIndex(
          (suggestion) => suggestion.id === values[0] && suggestion.organization_id === values[1]
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
