import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import type { DecisionEngine } from '../src/modules/decision-engine/decision-engine.js';
import { registerVisitorEvaluationDebugRoutes } from '../src/modules/visitor-evaluation/visitor-evaluation-routes.js';
import { scoreVisitorAnswer } from '../src/modules/visitor-evaluation/visitor-evaluation-scorer.js';
import { VisitorEvaluationService } from '../src/modules/visitor-evaluation/visitor-evaluation-service.js';

const organizationId = '00000000-0000-4000-8000-000000000001';
const siteId = '00000000-0000-4000-8000-000000000002';
const questionId = '00000000-0000-4000-8000-000000000003';
const token = 'visitor-evaluation-debug-token-32-chars';

const question = {
  id: questionId,
  organizationId,
  siteId,
  category: 'Tarifs',
  question: 'Combien coûte une séance ?',
  expectedAnswer: 'La séance coûte 350 euros et dure deux heures.',
  requiredFacts: ['350 euros', 'deux heures'],
  forbiddenFacts: ['gratuite'],
  expectedSourcePage: '/tarifs',
  importance: 5 as const
};

describe('Visitor Evaluation Engine', () => {
  it('detects incomplete, contradictory, vague and wrongly sourced answers', () => {
    const answer = scoreVisitorAnswer({
      question,
      producedAnswer: 'Contactez-nous. La séance est gratuite.',
      confidence: 0.4,
      responseTimeMs: 12,
      selectedChunk: 'wrong',
      selectedPage: '/faq',
      expectedWinner: 'prices'
    });
    assert.ok(answer.issues.includes('incomplete_answer'));
    assert.ok(answer.issues.includes('wrong_source'));
    assert.ok(answer.issues.includes('contradiction'));
    assert.ok(answer.issues.includes('too_vague'));
    assert.ok(answer.issues.includes('wrong_chunk_priority'));
    assert.ok(answer.score < 50);
  });

  it('runs the real decision engine contract and persists a weighted report', async () => {
    const statements: string[] = [];
    const database = databaseDouble(async <T extends pg.QueryResultRow>(sql: string) => {
      statements.push(sql);
      if (sql.includes('from visitor_evaluation_questions'))
        return rows([questionRow()]) as unknown as pg.QueryResult<T>;
      if (sql.includes('from knowledge_chunks'))
        return rows([
          {
            id: 'prices',
            document_id: 'doc-prices',
            source: 'https://example.test/tarifs',
            content: 'La séance coûte 350 euros et dure deux heures.'
          }
        ]) as unknown as pg.QueryResult<T>;
      return rows([]) as unknown as pg.QueryResult<T>;
    });
    const decisions: string[] = [];
    const decisionEngine = decisionDouble(async (message) => {
      decisions.push(message);
      return {
        reply: 'La séance coûte 350 euros et dure deux heures.',
        source: 'knowledge_search',
        confidence: 0.91,
        shouldEscalate: false,
        processingTimeMs: 8,
        matchedItemId: 'doc-prices',
        reason: 'knowledge_document:Tarifs'
      };
    });
    const report = await new VisitorEvaluationService(database, decisionEngine).evaluateAndStore({
      organizationId,
      siteId
    });
    assert.deepEqual(decisions, [question.question]);
    assert.equal(report.questionCount, 1);
    assert.equal(report.globalScore, 100);
    assert.equal(report.answers[0]?.selectedChunk, 'prices');
    assert.deepEqual(report.answers[0]?.issues, []);
    assert.ok(statements.some((sql) => sql.includes('insert into visitor_evaluation_reports')));
  });

  it('protects the dedicated debug endpoint', async () => {
    const database = databaseDouble(async <T extends pg.QueryResultRow>(sql: string) => {
      if (sql.includes('visitor_evaluation_questions')) return rows([]) as unknown as pg.QueryResult<T>;
      if (sql.includes('visitor_evaluation_reports')) return rows([]) as unknown as pg.QueryResult<T>;
      return rows([]) as unknown as pg.QueryResult<T>;
    });
    const app = Fastify();
    registerVisitorEvaluationDebugRoutes(
      app,
      new VisitorEvaluationService(database, decisionDouble()),
      token
    );
    const url = `/api/internal/visitor-evaluation/${siteId}?organizationId=${organizationId}`;
    const unauthorized = await app.inject({ method: 'GET', url });
    const authorized = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(unauthorized.statusCode, 401);
    assert.equal(authorized.statusCode, 200);
    assert.deepEqual(authorized.json(), { questions: [], report: null });
    await app.close();
  });
});

function questionRow() {
  return {
    id: questionId,
    organization_id: organizationId,
    site_id: siteId,
    category: question.category,
    question: question.question,
    expected_answer: question.expectedAnswer,
    required_facts: question.requiredFacts,
    forbidden_facts: question.forbiddenFacts,
    expected_source_page: question.expectedSourcePage,
    importance: question.importance
  };
}
function decisionDouble(
  decide?: (message: string) => Promise<Awaited<ReturnType<DecisionEngine['decide']>>>
): DecisionEngine {
  return {
    decide: async (input) =>
      decide
        ? decide(input.message)
        : {
            reply: '',
            source: 'fallback',
            confidence: 0,
            shouldEscalate: false,
            processingTimeMs: 1
          },
    getBusinessConfig: async () => {
      throw new Error('not used');
    }
  };
}
function databaseDouble(query: Database['query']): Database {
  return {
    isConfigured: () => true,
    checkConnection: async () => undefined,
    close: async () => undefined,
    query
  };
}
function rows<T extends pg.QueryResultRow>(values: T[]): pg.QueryResult<T> {
  return { rows: values, command: 'SELECT', rowCount: values.length, oid: 0, fields: [] };
}
