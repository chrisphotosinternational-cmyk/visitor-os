import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { analyzeSiteContent } from '../src/modules/site-intelligence/site-intelligence-analyzer.js';
import { registerSiteIntelligenceDebugRoutes } from '../src/modules/site-intelligence/site-intelligence-routes.js';
import { SiteIntelligenceService } from '../src/modules/site-intelligence/site-intelligence-service.js';

const organizationId = '00000000-0000-4000-8000-000000000001';
const siteId = '00000000-0000-4000-8000-000000000002';
const token = 'site-intelligence-debug-token-32-chars';

describe('Site Intelligence Engine', () => {
  it('classifies pages and content while reporting coverage and missing critical information', () => {
    const report = analyzeSiteContent({
      organizationId,
      siteId,
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
      pages: [
        {
          documentId: 'document-home',
          title: 'Photographe à Albi',
          source: 'https://example.test/',
          chunks: [{ chunkId: 'home-1', position: 0, content: 'H1: Photographe à Albi\nBienvenue au studio.' }]
        },
        {
          documentId: 'document-prices',
          title: 'Tarifs et formules',
          source: 'https://example.test/tarifs',
          chunks: [
            {
              chunkId: 'prices-1',
              position: 0,
              content: 'H2: Formule portrait\nLa séance dure 2 heures et coûte 350 €. Un acompte est demandé. Contact: hello@example.test.'
            }
          ]
        },
        {
          documentId: 'document-faq',
          title: 'Questions fréquentes',
          source: 'https://example.test/faq',
          chunks: [{ chunkId: 'faq-1', position: 0, content: 'FAQ Question: Les retouches sont-elles incluses ?\nFAQ Answer: Oui, les retouches sont incluses.' }]
        }
      ]
    });

    assert.equal(report.pageCount, 3);
    assert.equal(report.chunkCount, 3);
    assert.equal(report.pages[0]?.type, 'accueil');
    assert.equal(report.pages[1]?.type, 'tarifs');
    assert.equal(report.pages[2]?.type, 'FAQ');
    assert.ok(report.contentTypes.some((entry) => entry.category === 'prix'));
    assert.ok(report.contentTypes.some((entry) => entry.category === 'duree'));
    assert.ok(report.contentTypes.some((entry) => entry.category === 'retouches'));
    assert.ok(report.criticalInformationDetected.includes('acompte'));
    assert.ok(report.criticalInformationMissing.includes('telephone'));
    assert.ok(report.knowledgeCoverage.percentage > 0);
    assert.ok((report.categoryConfidence.tarifs ?? 0) > 0.5);
  });

  it('loads active chunks and persists a complete JSON report', async () => {
    const queries: string[] = [];
    const database = databaseDouble(async <T extends pg.QueryResultRow>(sql: string) => {
      queries.push(sql);
      if (sql.includes('from knowledge_documents')) {
        return rows([
          {
            document_id: 'document-1',
            title: 'Contact',
            source: 'https://example.test/contact',
            chunk_id: 'chunk-1',
            position: 0,
            content: 'Contactez-nous avec le formulaire ou par téléphone au 05 63 00 00 00.'
          }
        ]) as unknown as pg.QueryResult<T>;
      }
      return rows([]) as pg.QueryResult<T>;
    });
    const report = await new SiteIntelligenceService(database).analyzeAndStore({
      organizationId,
      siteId
    });

    assert.equal(report.pageCount, 1);
    assert.equal(report.chunkCount, 1);
    assert.equal(report.pages[0]?.type, 'contact');
    assert.ok(queries.some((query) => query.includes('insert into site_intelligence_reports')));
  });

  it('protects the dedicated report endpoint and returns the latest report', async () => {
    const report = analyzeSiteContent({ organizationId, siteId, pages: [] });
    const app = Fastify();
    const database = databaseDouble(async <T extends pg.QueryResultRow>() =>
      rows([{ report }]) as unknown as pg.QueryResult<T>
    );
    registerSiteIntelligenceDebugRoutes(
      app,
      new SiteIntelligenceService(database),
      token
    );
    const url = `/api/internal/site-intelligence/${siteId}?organizationId=${organizationId}`;
    const unauthorized = await app.inject({ method: 'GET', url });
    const authorized = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(unauthorized.statusCode, 401);
    assert.equal(authorized.statusCode, 200);
    assert.equal(authorized.json<{ siteId: string }>().siteId, siteId);
    await app.close();
  });
});

function databaseDouble(
  query: <T extends pg.QueryResultRow>(sql: string) => Promise<pg.QueryResult<T>>
): Database {
  return {
    isConfigured: () => true,
    async checkConnection() {},
    async close() {},
    query
  };
}

function rows<T extends pg.QueryResultRow>(values: T[]): pg.QueryResult<T> {
  return { rows: values, command: 'SELECT', rowCount: values.length, oid: 0, fields: [] };
}
