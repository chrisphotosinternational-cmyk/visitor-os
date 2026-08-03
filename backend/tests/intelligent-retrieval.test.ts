import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import Fastify from 'fastify';
import type { KnowledgeSearch } from '../src/modules/kms/knowledge-search.js';
import type { SiteIntelligenceService } from '../src/modules/site-intelligence/site-intelligence-service.js';
import type { SiteIntelligenceReport } from '../src/modules/site-intelligence/site-intelligence-types.js';
import type { VisitorEvaluationReport } from '../src/modules/visitor-evaluation/visitor-evaluation-types.js';
import { IntelligentRetrievalEngine } from '../src/modules/intelligent-retrieval/intelligent-retrieval-engine.js';
import { registerIntelligentRetrievalDebugRoutes } from '../src/modules/intelligent-retrieval/intelligent-retrieval-routes.js';
import { detectRetrievalIntent } from '../src/modules/intelligent-retrieval/intent-detector.js';
import { compareReports } from '../src/modules/intelligent-retrieval/retrieval-benchmark-service.js';

const bonuses = { category: 0.08, pageType: 0.06, blockType: 0.12, closeScoreThreshold: 0.15 };
const report: SiteIntelligenceReport = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  siteId: '00000000-0000-4000-8000-000000000002',
  generatedAt: new Date(0).toISOString(),
  pageCount: 2,
  chunkCount: 2,
  pages: [
    {
      documentId: 'prices',
      title: 'Tarifs',
      page: '/tarifs',
      type: 'tarifs',
      confidence: 1,
      evidence: [],
      chunkCount: 1
    },
    {
      documentId: 'faq',
      title: 'FAQ',
      page: '/faq',
      type: 'FAQ',
      confidence: 1,
      evidence: [],
      chunkCount: 1
    }
  ],
  chunks: [
    {
      chunkId: 'price-chunk',
      documentId: 'prices',
      page: '/tarifs',
      position: 0,
      excerpt: 'Séance couple 250 euros',
      detections: [{ category: 'prix', confidence: 1, evidence: ['250 euros'] }]
    },
    {
      chunkId: 'faq-chunk',
      documentId: 'faq',
      page: '/faq',
      position: 0,
      excerpt: 'Questions générales',
      detections: [{ category: 'FAQ', confidence: 1, evidence: ['FAQ'] }]
    }
  ],
  pageTypes: [],
  contentTypes: [],
  knowledgeCoverage: { detectedCategories: 2, expectedCategories: 20, percentage: 10 },
  criticalInformationDetected: ['prix'],
  criticalInformationMissing: [],
  categoryConfidence: {} as never
};

function engine(enabled = true): IntelligentRetrievalEngine {
  const search: KnowledgeSearch = {
    search: mock.fn(async () => [
      {
        documentId: 'faq',
        title: 'FAQ',
        content: 'Questions générales',
        category: 'FAQ',
        language: 'fr',
        score: 0.9,
        relevance: 'high',
        source: '/faq'
      },
      {
        documentId: 'prices',
        title: 'Tarifs',
        content: 'Séance couple 250 euros',
        category: 'pricing',
        language: 'fr',
        score: 0.82,
        relevance: 'high',
        source: '/tarifs'
      }
    ])
  };
  const intelligence = {
    latest: mock.fn(async () => report)
  } as unknown as SiteIntelligenceService;
  return new IntelligentRetrievalEngine(search, intelligence, bonuses, enabled);
}

describe('IntelligentRetrievalEngine', () => {
  it('detects supported intents without affecting general questions', () => {
    assert.equal(detectRetrievalIntent('Combien coûte une séance couple ?'), 'pricing');
    assert.equal(detectRetrievalIntent('Puis-je payer un acompte ?'), 'paiement');
    assert.equal(detectRetrievalIntent('Bonjour, comment allez-vous ?'), 'general');
  });

  it('uses Site Intelligence bonuses to prefer the matching commercial block', async () => {
    const trace = await engine().inspect({
      organizationId: report.organizationId,
      siteId: report.siteId,
      query: 'Combien coûte une séance couple ?'
    });
    assert.equal(trace.intent, 'pricing');
    assert.deepEqual(trace.categories, ['prix', 'tableau', 'prestation']);
    assert.equal(trace.candidates[0]?.documentId, 'prices');
    assert.equal(trace.candidates[0]?.scoreBeforeBonus, 0.82);
    assert.ok((trace.candidates[0]?.scoreAfterBonus ?? 0) > 0.82);
    assert.deepEqual(
      trace.candidates[0]?.bonusesApplied.map((bonus) => bonus.kind),
      ['page_type', 'block_type']
    );
    assert.ok((trace.candidates[1]?.bonusesRefused.length ?? 0) > 0);
    assert.match(trace.candidates[0]?.justification ?? '', /Bonus/);
  });

  it('preserves candidates exactly when disabled', async () => {
    const results = await engine(false).search({
      organizationId: report.organizationId,
      siteId: report.siteId,
      query: 'Combien coûte une séance couple ?'
    });
    assert.deepEqual(
      results.map(({ documentId, score }) => [documentId, score]),
      [
        ['faq', 0.9],
        ['prices', 0.82]
      ]
    );
  });

  it('protects the dedicated debug endpoint', async () => {
    const app = Fastify();
    registerIntelligentRetrievalDebugRoutes(app, engine(), 'intelligent-retrieval-debug-token-32');
    const url = `/api/internal/intelligent-retrieval/${report.siteId}`;
    const body = { organizationId: report.organizationId, question: 'Quel est le prix ?' };
    assert.equal((await app.inject({ method: 'POST', url, payload: body })).statusCode, 401);
    const response = await app.inject({
      method: 'POST',
      url,
      payload: body,
      headers: { authorization: 'Bearer intelligent-retrieval-debug-token-32' }
    });
    assert.equal(response.statusCode, 200);
    assert.equal((response.json() as { intent: string }).intent, 'pricing');
    await app.close();
  });
});

describe('retrieval benchmark', () => {
  it('accepts improvements and rejects category or error regressions', () => {
    const baseline = evaluation('baseline', 80, 80, 2);
    const improved = evaluation('improved', 90, 90, 1);
    const regressed = evaluation('regressed', 90, 70, 3);
    const input = { organizationId: report.organizationId, siteId: report.siteId };
    const accepted = compareReports(input, baseline, improved);
    assert.equal(accepted.accepted, true);
    assert.equal(accepted.globalScoreDelta, 10);
    assert.equal(accepted.categoryDeltas.pricing, 10);
    assert.equal(accepted.errorDeltas.incomplete_answer, -1);
    assert.equal(compareReports(input, baseline, regressed).accepted, false);
  });
});

function evaluation(
  id: string,
  globalScore: number,
  categoryScore: number,
  incomplete: number
): VisitorEvaluationReport {
  return {
    id,
    organizationId: report.organizationId,
    siteId: report.siteId,
    generatedAt: new Date(0).toISOString(),
    globalScore,
    questionCount: 1,
    scoresByCategory: [{ category: 'pricing', score: categoryScore, questionCount: 1 }],
    scoresByPage: [],
    scoresByContentType: [],
    issueCounts: {
      incomplete_answer: incomplete,
      wrong_source: 0,
      contradiction: 0,
      hallucination: 0,
      too_vague: 0,
      wrong_chunk_priority: 0
    },
    answers: [],
    bestAnswers: [],
    worstAnswers: []
  };
}
