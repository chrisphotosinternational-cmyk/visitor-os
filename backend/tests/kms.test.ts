import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { createDecisionEngine } from '../src/modules/decision-engine/decision-engine.js';
import { KnowledgeDocumentExtractor } from '../src/modules/kms/document-extractor.js';
import { KnowledgeIndexingQueue } from '../src/modules/kms/indexing-queue.js';
import { KnowledgeImporter } from '../src/modules/kms/knowledge-importer.js';
import { KnowledgeIndexer, chunkKnowledgeText } from '../src/modules/kms/knowledge-indexer.js';
import { KnowledgeRepository } from '../src/modules/kms/knowledge-repository.js';
import { SiteCrawlerService } from '../src/modules/kms/site-crawler.js';
import type {
  KnowledgeDocument,
  KnowledgeImportInput,
  KnowledgeVersion
} from '../src/modules/kms/knowledge-types.js';
import { KnowledgeValidator } from '../src/modules/kms/knowledge-validator.js';
import type { BusinessConfig } from '../src/modules/business-config/business-config-schema.js';
import type {
  BusinessConfigEngine,
  BusinessConfigSummary
} from '../src/modules/business-config/configuration-loader.js';

describe('Knowledge Management System', () => {
  it('validates supported document imports', () => {
    const validator = new KnowledgeValidator();
    const valid = validator.validateImport({
      organizationId,
      siteId,
      title: 'Guide parking',
      category: 'access',
      type: 'markdown',
      content: 'Le parking est ouvert 24h/24.'
    });

    assert.equal(valid.language, 'fr');
    assert.throws(
      () =>
        validator.validateImport({
          organizationId,
          title: 'Guide sans site',
          category: 'access',
          type: 'markdown',
          content: 'Le parking est ouvert 24h/24.'
        }),
      /siteId/
    );
    assert.throws(() => validator.validateImport({ title: '' }), /organizationId/);
  });

  it('aggregates short paragraphs into a searchable chunk', () => {
    const chunks = new KnowledgeIndexer().createChunks({
      documentId,
      organizationId,
      siteId,
      content: 'Premier paragraphe.\n\nParking disponible proche.'
    });

    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]?.tokens.includes('parking'));
    assert.match(chunks[0]?.content ?? '', /Premier paragraphe\.\n\nParking/);
  });

  it('chunks long documents with configurable overlap', () => {
    const chunks = chunkKnowledgeText(
      'A'.repeat(250) + ' phrase utile parking. ' + 'B'.repeat(250),
      {
        maxCharacters: 220,
        overlapCharacters: 40,
        splitByParagraph: false
      }
    );

    assert.ok(chunks.length >= 2);
    assert.ok(chunks.every((chunk) => chunk.length <= 220));
    assert.ok(chunks.slice(1).every((chunk) => chunk.length >= 40));
  });

  it('packs many small paragraphs into homogeneous default-sized chunks', () => {
    const paragraphs = Array.from(
      { length: 30 },
      (_, index) => `Paragraphe ${index + 1}: ${String.fromCharCode(65 + (index % 26)).repeat(90)}`
    );
    const chunks = chunkKnowledgeText(paragraphs.join('\n\n'));

    assert.ok(chunks.length >= 3);
    assert.ok(chunks.every((chunk) => chunk.length <= 1200));
    assert.ok(chunks.slice(0, -1).every((chunk) => chunk.length >= 800));
    assert.ok(chunks.every((chunk) => chunk.trim().length > 0));
  });

  it('does not create useless micro-chunks from headings and short list items', () => {
    const content = [
      'H1: Accueil',
      'H2: Services',
      '- Studio',
      '- Extérieur',
      'Une présentation suffisamment détaillée des prestations proposées aux visiteurs.'
    ].join('\n\n');
    const chunks = chunkKnowledgeText(content);

    assert.equal(chunks.length, 1);
    const chunk = chunks[0] ?? '';
    const h1Position = chunk.indexOf('H1: Accueil');
    const h2Position = chunk.indexOf('H2: Services');
    const explanationPosition = chunk.indexOf(
      'Une présentation suffisamment détaillée des prestations proposées aux visiteurs.'
    );

    assert.ok(h1Position >= 0);
    assert.ok(h2Position > h1Position);
    assert.ok(explanationPosition > h2Position);
    assert.ok(chunks.every((chunk) => chunk.length >= 50));
  });

  it('keeps a very short document as one justified short chunk', () => {
    assert.deepEqual(chunkKnowledgeText('Parking privé.'), ['Parking privé.']);
  });

  it('returns no chunks for empty or whitespace-only content', () => {
    assert.deepEqual(chunkKnowledgeText(' \n\n  \r\n '), []);
  });

  it('keeps tables intact while packing them with related context', () => {
    const introduction = 'Tarifs applicables pour la saison en cours.';
    const table = 'Table: Formule Essentielle | 800 euros | Formule Premium | 1200 euros';
    const conclusion = 'Tous les forfaits incluent la préparation et la livraison.';
    const chunks = chunkKnowledgeText([introduction, table, conclusion].join('\n\n'));

    assert.equal(chunks.length, 1);
    assert.match(chunks[0] ?? '', new RegExp(table.replace(/[|]/g, '\\|')));
  });

  it('keeps each FAQ question and answer in its own semantic chunk', () => {
    const first = 'FAQ Question: Le parking est-il disponible ?\nFAQ Answer: Oui, sur réservation.';
    const second =
      'FAQ Question: Les animaux sont-ils admis ?\nFAQ Answer: Non, sauf animaux guides.';
    const chunks = chunkKnowledgeText(`${first}\n\n${second}`);

    assert.deepEqual(chunks, [first, second]);
  });

  it('preserves paragraph boundaries and contextual overlap between chunks', () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, index) => `Section ${index + 1}. ${String.fromCharCode(65 + index).repeat(120)}`
    );
    const chunks = chunkKnowledgeText(paragraphs.join('\n\n'), {
      maxCharacters: 500,
      overlapCharacters: 100,
      splitByParagraph: true
    });

    assert.ok(chunks.length >= 3);
    assert.ok(chunks.every((chunk) => chunk.length <= 500));
    assert.ok(chunks.every((chunk) => !chunk.startsWith(' ') && !chunk.endsWith(' ')));
    assert.ok(
      chunks.slice(1).every((chunk, index) => {
        const previous = chunks[index] ?? '';
        return Array.from({ length: 100 }, (_, offset) => 100 - offset).some(
          (length) => length >= 50 && chunk.startsWith(previous.slice(-length))
        );
      })
    );
  });

  it('honours disabled overlap', () => {
    const content = Array.from(
      { length: 8 },
      (_, index) => `Bloc ${index}: ${'x'.repeat(90)}`
    ).join('\n\n');
    const chunks = chunkKnowledgeText(content, {
      maxCharacters: 300,
      overlapCharacters: 0,
      splitByParagraph: true
    });

    const occurrences = chunks.join('\n').match(/Bloc \d+:/g) ?? [];
    assert.equal(occurrences.length, 8);
  });

  it('extracts real file content from supported document formats', () => {
    const extractor = new KnowledgeDocumentExtractor();
    const markdown = extractor.extract({
      organizationId,
      fileName: 'guide.md',
      data: Buffer.from('# Parking\n\nParking ouvert 24h/24.')
    });
    const html = extractor.extract({
      organizationId,
      fileName: 'guide.html',
      data: Buffer.from('<h1>Acces</h1><p>Metro proche &amp; parking.</p>')
    });
    const csv = extractor.extract({
      organizationId,
      fileName: 'tarifs.csv',
      data: Buffer.from('nom,prix\nDay use,80')
    });
    const json = extractor.extract({
      organizationId,
      fileName: 'faq.json',
      data: Buffer.from(JSON.stringify({ parking: { answer: 'Disponible' } }))
    });
    const pdf = extractor.extract({
      organizationId,
      fileName: 'guide.pdf',
      data: createSimplePdf('Parking PDF disponible')
    });
    const docx = extractor.extract({
      organizationId,
      fileName: 'guide.docx',
      data: createSimpleDocx('Parking DOCX disponible')
    });

    assert.match(markdown.text, /Parking ouvert/);
    assert.match(html.text, /Metro proche & parking/);
    assert.equal(csv.metadata.rowCount, 2);
    assert.match(json.text, /parking.answer: Disponible/);
    assert.match(pdf.text, /Parking PDF disponible/);
    assert.match(docx.text, /Parking DOCX disponible/);
  });

  it('imports, versions and searches knowledge documents', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const document = await importer.import({
      organizationId,
      siteId,
      title: 'Guide parking',
      category: 'access',
      type: 'markdown',
      content: 'Le parking couvert se trouve rue Demo.',
      tags: ['parking'],
      author: 'admin'
    });

    const results = await repository.search({
      organizationId,
      siteId,
      query: 'parking couvert',
      limit: 5
    });
    const versions = await repository.versions(document.document.id, organizationId);

    assert.equal(document.document.version, 1);
    assert.equal(results[0]?.documentId, document.document.id);
    assert.ok((results[0]?.score ?? 0) > 0);
    assert.equal(versions.length, 1);
  });

  it('refuses chatbot knowledge imports without a site id', async () => {
    const repository = new KnowledgeRepository(createKnowledgeDatabase());
    const importer = new KnowledgeImporter(repository);

    await assert.rejects(
      () =>
        importer.import({
          organizationId,
          title: 'Guide global refuse',
          category: 'access',
          type: 'txt',
          content: 'Ce document global ne doit pas alimenter un widget.'
        } as never),
      /siteId/
    );
  });

  it('imports files through the indexing queue and versions same file replacements', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const queue = new KnowledgeIndexingQueue(importer);

    const first = await queue.enqueueFileImport({
      organizationId,
      siteId,
      fileName: 'guide.txt',
      category: 'access',
      data: Buffer.from('Le parking est disponible.')
    });
    const second = await queue.enqueueFileImport({
      organizationId,
      siteId,
      fileName: 'guide.txt',
      category: 'access',
      data: Buffer.from('Le parking est disponible et couvert.')
    });
    const versions = await repository.versions(first.report.document.id, organizationId);

    assert.equal(first.job.status, 'completed');
    assert.equal(second.report.document.id, first.report.document.id);
    assert.equal(second.report.document.version, 2);
    assert.equal(versions.length, 2);
    assert.equal(queue.list(organizationId, siteId).length, 2);
  });

  it('reimports one web source without duplicate documents or useless versions', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const input: KnowledgeImportInput = {
      organizationId,
      siteId,
      title: 'Page accès',
      category: 'website',
      type: 'html',
      content: 'Le parking initial est disponible sur réservation.',
      source: 'https://example.test/acces'
    };

    const first = await importer.import(input);
    const unchanged = await importer.import(input);
    const modified = await importer.import({
      ...input,
      content: 'Le parking modifié est couvert et disponible sur réservation.'
    });
    const documents = await repository.list({ organizationId, siteId });
    const versions = await repository.versions(first.document.id, organizationId);

    assert.equal(unchanged.document.id, first.document.id);
    assert.equal(unchanged.document.version, 1);
    assert.equal(unchanged.chunks, 0);
    assert.equal(modified.document.id, first.document.id);
    assert.equal(modified.document.version, 2);
    assert.equal(documents.length, 1);
    assert.equal(versions.length, 2);
  });

  it('rolls back document, version and chunks when chunk persistence fails', async () => {
    const failures = { failChunkInsert: false };
    const database = createKnowledgeDatabase(failures);
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const input: KnowledgeImportInput = {
      organizationId,
      siteId,
      title: 'Page transactionnelle',
      category: 'website',
      type: 'html',
      content: 'Contenu stable avant la tentative de remplacement.',
      source: 'https://example.test/transaction'
    };
    const first = await importer.import(input);
    failures.failChunkInsert = true;

    await assert.rejects(
      () => importer.import({ ...input, content: 'Nouveau contenu qui doit être annulé.' }),
      /chunk insert failure/
    );

    const [document] = await repository.list({ organizationId, siteId });
    const versions = await repository.versions(first.document.id, organizationId);
    const oldResults = await repository.search({
      organizationId,
      siteId,
      query: 'stable',
      limit: 5
    });

    assert.equal(document?.version, 1);
    assert.equal(versions.length, 1);
    assert.equal(oldResults[0]?.documentId, first.document.id);
  });

  it('runs the chunker exactly once for one import', async () => {
    const repository = new KnowledgeRepository(createKnowledgeDatabase());
    let calls = 0;
    const indexer = new KnowledgeIndexer();
    const originalCreateChunks = indexer.createChunks.bind(indexer);
    indexer.createChunks = (input) => {
      calls += 1;
      return originalCreateChunks(input);
    };
    const importer = new KnowledgeImporter(repository, undefined, indexer);

    await importer.import({
      organizationId,
      siteId,
      title: 'Passage unique',
      category: 'website',
      type: 'html',
      content: 'Ce contenu ne doit être découpé qu’une seule fois.',
      source: 'https://example.test/unique-pass'
    });

    assert.equal(calls, 1);
  });

  it('keeps document search isolated by organization', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    await importer.import({
      organizationId,
      siteId,
      title: 'Guide prive',
      category: 'access',
      type: 'txt',
      content: 'Parking strictement organisation A.'
    });

    const forbidden = await repository.search({
      organizationId: '00000000-0000-4000-8000-000000000999',
      siteId,
      query: 'parking',
      limit: 5
    });

    assert.equal(forbidden.length, 0);
  });

  it('keeps KMS document searches strictly isolated by site and ignores legacy global documents', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const siteDocument = await importer.import({
      organizationId,
      siteId,
      title: 'Guide Albi',
      category: 'access',
      type: 'txt',
      content: 'Parking prive pour le studio Albi.',
      tags: ['parking']
    });
    await importer.import({
      organizationId,
      siteId: otherSiteId,
      title: 'Guide Toulouse',
      category: 'access',
      type: 'txt',
      content: 'Parking reserve au studio Toulouse.',
      tags: ['parking']
    });
    const legacyGlobal = await repository.upsertDocument({
      organizationId,
      siteId: null,
      title: 'Guide global historique',
      category: 'access',
      type: 'txt',
      content: 'Parking global historique a ne pas utiliser.',
      tags: ['parking']
    } as never);
    await database.query(
      `
      insert into knowledge_chunks (
        id,
        document_id,
        organization_id,
        site_id,
        content,
        position,
        tokens,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        'legacy-global-chunk',
        legacyGlobal.id,
        organizationId,
        null,
        'Parking global historique a ne pas utiliser.',
        0,
        ['parking', 'global', 'historique'],
        '{}'
      ]
    );

    const siteResults = await repository.search({
      organizationId,
      siteId,
      query: 'parking',
      limit: 10
    });
    const otherSiteResults = await repository.search({
      organizationId,
      siteId: otherSiteId,
      query: 'parking',
      limit: 10
    });
    const wrongSiteResults = await repository.search({
      organizationId,
      siteId: '00000000-0000-4000-8000-000000000202',
      query: 'parking',
      limit: 10
    });

    assert.deepEqual(
      siteResults.map((result) => result.documentId),
      [siteDocument.document.id]
    );
    assert.equal(otherSiteResults.length, 1);
    assert.notEqual(otherSiteResults[0]?.documentId, siteDocument.document.id);
    assert.equal(wrongSiteResults.length, 0);
  });

  it('lists, archives, deletes and exposes statistics', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const document = await importer.import({
      organizationId,
      siteId,
      title: 'FAQ petit dejeuner',
      category: 'services',
      type: 'txt',
      content: 'Le petit dejeuner est servi de 7h a 10h.'
    });

    assert.equal((await repository.list({ organizationId, siteId })).length, 1);
    assert.equal(
      (await repository.archive(document.document.id, organizationId))?.status,
      'archived'
    );
    assert.equal(await repository.delete(document.document.id, organizationId), true);
    assert.equal((await repository.statistics(organizationId, siteId)).documents, 1);
  });

  it('lets the Decision Engine answer from Knowledge Search before AI', async () => {
    let aiCalls = 0;
    const engine = createDecisionEngine({
      businessConfigEngine: createMemoryBusinessConfigEngine(testConfig),
      knowledgeSearch: {
        async search() {
          return [
            {
              documentId,
              title: 'Guide spa',
              content: 'Le spa est accessible sur reservation.',
              category: 'services',
              language: 'fr',
              score: 0.82,
              relevance: 'high',
              source: 'manual'
            }
          ];
        }
      },
      aiProvider: {
        providerName: 'mock',
        async generateReply() {
          aiCalls += 1;
          throw new Error('AI should not be called when KMS matches');
        },
        estimateCost() {
          return 0;
        }
      }
    });
    const result = await engine.decide({
      organizationId,
      siteId,
      conversationId: '00000000-0000-4000-8000-000000000201',
      activity: 'test-config',
      message: 'Le spa est-il accessible ?',
      recentHistory: []
    });

    assert.equal(result.source, 'knowledge_search');
    assert.equal(result.reply, 'Le spa est accessible sur reservation.');
    assert.equal(aiCalls, 0);
  });

  it('refuses to crawl a start URL outside the registered site domain', async () => {
    const crawler = new SiteCrawlerService(createRecordingImporter().importer);

    await assert.rejects(
      () =>
        crawler.crawl({
          organizationId,
          siteId,
          siteDomain: 'photographe-boudoir-albi.ovh',
          startUrl: 'https://example.com',
          delayMs: 0
        }),
      /domain/i
    );
  });


  it('keeps crawled JSON-LD FAQ entries in separate chunks', async () => {
    const indexer = new KnowledgeIndexer();
    const content = [
      'FAQ Question: Puis-je dormir à l hôtel après la séance ?\nFAQ Answer: Les hôtels partenaires sont listés dans le guide d accueil.',
      'FAQ Question: Combien de photos sont livrées après une séance ?\nFAQ Answer: Après la séance, 12 photos retouchées sont livrées sous 3 semaines.',
      'FAQ Question: Est-ce que les fichiers originaux sont remis ?\nFAQ Answer: Les fichiers originaux ne sont pas remis.'
    ].join('\n\n');

    const chunks = indexer.createChunks({
      documentId,
      organizationId,
      siteId,
      content
    });

    assert.equal(chunks.length, 3);
    assert.match(chunks[1]?.content ?? '', /Combien de photos/);
    assert.match(chunks[1]?.content ?? '', /12 photos retouchées/);
    assert.doesNotMatch(chunks[1]?.content ?? '', /hôtels partenaires/);
    assert.doesNotMatch(chunks[1]?.content ?? '', /originaux/);
  });


  it('combines robots and sitemap discovery with normalized URL reporting and strict site imports', async () => {
    const imported = createRecordingImporter();
    const fetched: string[] = [];
    const responses = new Map<string, { body: string; status?: number; url?: string }>([
      [
        'https://photographe-boudoir-albi.ovh/robots.txt',
        { body: `User-agent: *\nDisallow: /private\nSitemap: https://www.photographe-boudoir-albi.ovh/sitemap_index.xml` }
      ],
      [
        'https://photographe-boudoir-albi.ovh/sitemap_index.xml',
        {
          body: `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://photographe-boudoir-albi.ovh/sitemap-pages.xml</loc></sitemap><sitemap><loc>https://photographe-boudoir-albi.ovh/sitemap-extra.xml</loc></sitemap></sitemapindex>`
        }
      ],
      [
        'https://photographe-boudoir-albi.ovh/sitemap.xml',
        {
          body: `<?xml version="1.0"?><urlset><url><loc>https://photographe-boudoir-albi.ovh/faq?utm_source=google#photos</loc></url><url><loc>https://example.com/externe</loc></url></urlset>`
        }
      ],
      [
        'https://photographe-boudoir-albi.ovh/sitemap-pages.xml',
        {
          body: `<?xml version="1.0"?><urlset><url><loc>https://photographe-boudoir-albi.ovh/faq?utm_campaign=x#top</loc></url><url><loc>https://photographe-boudoir-albi.ovh/studio/</loc></url></urlset>`
        }
      ],
      [
        'https://photographe-boudoir-albi.ovh/sitemap-extra.xml',
        {
          body: `<?xml version="1.0"?><urlset><url><loc>https://photographe-boudoir-albi.ovh/missing</loc></url><url><loc>https://blog.photographe-boudoir-albi.ovh/satellite</loc></url></urlset>`
        }
      ],
      [
        'https://photographe-boudoir-albi.ovh/faq',
        { body: '<html><head><title>FAQ photos</title><link rel="canonical" href="https://www.photographe-boudoir-albi.ovh/faq/" /></head><body><h1>FAQ</h1><p>Combien de photos sont livrées ? 12 photos retouchées.</p></body></html>' }
      ],
      [
        'https://photographe-boudoir-albi.ovh/studio',
        { body: '<html><head><title>Studio Albi</title></head><body><p>Le studio accueille les shootings boudoir.</p></body></html>' }
      ],
      ['https://photographe-boudoir-albi.ovh/missing', { body: 'not found', status: 404 }],
      [
        'https://photographe-boudoir-albi.ovh/',
        { body: '<html><head><title>Accueil</title></head><body><a href="/retouches?utm_medium=email&utm_source=newsletter#details">Retouches</a><a href="https://example.com/offre">Externe</a></body></html>' }
      ],
      [
        'https://photographe-boudoir-albi.ovh/retouches',
        {
          body: '<html><head><title>Retouches</title></head><body><p>Les retouches sont incluses.</p></body></html>',
          url: 'https://www.photographe-boudoir-albi.ovh/retouches/?utm_source=redirect'
        }
      ]
    ]);
    const crawler = new SiteCrawlerService(imported.importer, async (url) => {
      fetched.push(url);
      const response = responses.get(url);
      return createCrawlResponse(response?.body ?? '', response?.status ?? (response ? 200 : 404), response?.url);
    });

    const summary = await crawler.crawl({
      organizationId,
      siteId,
      siteDomain: 'photographe-boudoir-albi.ovh',
      startUrl: 'https://www.photographe-boudoir-albi.ovh/?utm_source=admin#start',
      maxPages: 6,
      delayMs: 0,
      now: new Date('2026-07-23T00:00:00.000Z')
    });

    assert.equal(summary.sitemapUrlCount, 3);
    assert.equal(summary.discoveredUrlCount, 5);
    assert.equal(summary.crawledUrlCount, 5);
    assert.equal(summary.importedUrlCount, 4);
    assert.equal(summary.skippedUrlCount, 1);
    assert.equal(summary.errorUrlCount, 0);
    assert.equal(summary.sitemapCoveragePercent, 100);
    assert.equal(fetched.includes('https://example.com/offre'), false);
    assert.equal(fetched.some((url) => url.includes('utm_')), false);
    assert.equal(fetched.includes('https://blog.photographe-boudoir-albi.ovh/satellite'), false);
    assert.ok(summary.urls.some((url) => url.initialUrl.endsWith('/missing') && url.reason === 'http 404'));
    assert.ok(summary.urls.some((url) => url.finalUrl === 'https://photographe-boudoir-albi.ovh/retouches'));
    assert.deepEqual(imported.inputs.map((input) => input.organizationId), [organizationId, organizationId, organizationId, organizationId]);
    assert.deepEqual(imported.inputs.map((input) => input.siteId), [siteId, siteId, siteId, siteId]);
    assert.equal(imported.inputs.some((input) => input.source?.includes('example.com')), false);
    assert.ok(imported.inputs.some((input) => input.source === 'https://photographe-boudoir-albi.ovh/faq'));
    assert.ok(imported.inputs.some((input) => input.source === 'https://photographe-boudoir-albi.ovh/retouches'));
  });

  it('crawls only internal pages, deduplicates URLs, respects robots and imports into KMS by site', async () => {
    const imported = createRecordingImporter();
    const fetched: string[] = [];
    const responses = new Map<string, string>([
      ['https://photographe-boudoir-albi.ovh/robots.txt', `User-agent: *\nDisallow: /private`],
      [
        'https://photographe-boudoir-albi.ovh/',
        `
        <html>
          <head>
            <title>Photographe boudoir Albi</title>
            <meta name="description" content="Séance photo boudoir à Albi">
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [{
                  "@type": "Question",
                  "name": "Quels sont les tarifs ?",
                  "acceptedAnswer": { "@type": "Answer", "text": "Les forfaits commencent à 190 euros." }
                }]
              }
            </script>
          </head>
          <body>
            <nav>Menu répété</nav>
            <h1>Studio boudoir à Albi</h1>
            <p>Prestations photo boudoir pour Albi et le Tarn.</p>
            <details><summary>Déroulement</summary><p>La séance dure environ deux heures.</p></details>
            <ul><li>Prise de contact</li><li>Guide de préparation</li></ul>
            <table><tr><td>Formule découverte</td><td>190€</td></tr></table>
            <a href="/about#team">À propos</a>
            <a href="/about">Doublon À propos</a>
            <a href="/private">Privé</a>
            <a href="https://example.com/offre">Externe</a>
            <a href="https://blog.photographe-boudoir-albi.ovh/">Sous-domaine</a>
            <a href="mailto:contact@example.com">Email</a>
            <a href="javascript:void(0)">JS</a>
          </body>
        </html>
        `
      ],
      [
        'https://photographe-boudoir-albi.ovh/about',
        `
        <html>
          <head><title>À propos du studio</title></head>
          <body>
            <h1>Photographe à Albi</h1>
            <h2>Zones géographiques</h2>
            <p>Le studio accompagne les clientes à Albi, Gaillac et Castres.</p>
            <a href="/tarifs">Tarifs</a>
          </body>
        </html>
        `
      ],
      [
        'https://photographe-boudoir-albi.ovh/private',
        '<html><body><p>Cette page ne doit pas être téléchargée.</p></body></html>'
      ],
      [
        'https://photographe-boudoir-albi.ovh/tarifs',
        '<html><body><p>Cette page dépasse la limite.</p></body></html>'
      ]
    ]);
    const crawler = new SiteCrawlerService(imported.importer, async (url) => {
      fetched.push(url);
      const body = responses.get(url);
      return createCrawlResponse(body ?? '', body !== undefined ? 200 : 404);
    });

    const summary = await crawler.crawl({
      organizationId,
      siteId,
      siteDomain: 'https://photographe-boudoir-albi.ovh',
      startUrl: 'https://photographe-boudoir-albi.ovh/#accueil',
      maxPages: 3,
      delayMs: 0,
      now: new Date('2026-07-22T00:00:00.000Z')
    });

    assert.equal(summary.pagesImported, 2);
    assert.equal(summary.pagesSkipped, 1);
    assert.equal(summary.documentsCreated, 2);
    assert.ok(summary.chunksCreated >= 2);
    assert.deepEqual(
      imported.inputs.map((input) => input.siteId),
      [siteId, siteId]
    );
    assert.equal(imported.inputs.some((input) => input.siteId === null), false);
    assert.deepEqual(
      imported.inputs.map((input) => input.source),
      ['https://photographe-boudoir-albi.ovh/', 'https://photographe-boudoir-albi.ovh/about']
    );
    assert.match(imported.inputs[0]?.content ?? '', /FAQ Question: Quels sont les tarifs/);
    assert.match(imported.inputs[0]?.content ?? '', /FAQ Answer: Les forfaits commencent à 190 euros/);
    assert.match(imported.inputs[0]?.content ?? '', /Formule découverte 190€/);
    assert.doesNotMatch(imported.inputs[0]?.content ?? '', /Crawled at:/);
    assert.equal(fetched.includes('https://example.com/offre'), false);
    assert.equal(fetched.includes('https://blog.photographe-boudoir-albi.ovh/'), false);
    assert.equal(fetched.includes('https://photographe-boudoir-albi.ovh/tarifs'), false);
    assert.equal(summary.skipped[0]?.reason, 'robots.txt');
  });
});

const organizationId = '00000000-0000-4000-8000-000000000001';
const siteId = '00000000-0000-4000-8000-000000000101';
const otherSiteId = '00000000-0000-4000-8000-000000000102';
const documentId = '00000000-0000-4000-8000-000000000301';

function createRecordingImporter(): {
  importer: KnowledgeImporter;
  inputs: KnowledgeImportInput[];
} {
  const inputs: KnowledgeImportInput[] = [];
  const importer = {
    async import(input: KnowledgeImportInput) {
      inputs.push(input);
      const document: KnowledgeDocument = {
        id: `document-${inputs.length}`,
        organization_id: input.organizationId,
        site_id: input.siteId,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        type: input.type,
        language: input.language ?? 'fr',
        version: 1,
        size_bytes: Buffer.byteLength(input.content, 'utf8'),
        hash: `hash-${inputs.length}`,
        status: 'active',
        tags: input.tags ?? [],
        author: input.author ?? null,
        source: input.source ?? 'manual',
        usage_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      return { document, chunks: 1 };
    }
  } as KnowledgeImporter;

  return { importer, inputs };
}

function createCrawlResponse(body: string, status = 200, url?: string): {
  ok: boolean;
  status: number;
  url?: string;
  text(): Promise<string>;
  headers: { get(name: string): string | null };
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    ...(url ? { url } : {}),
    async text() {
      return body;
    },
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null;
      }
    }
  };
}

function createKnowledgeDatabase(options: { failChunkInsert?: boolean } = {}): Database {
  const documents = new Map<string, KnowledgeDocument>();
  const versions: KnowledgeVersion[] = [];
  const chunks: Array<{
    id: string;
    document_id: string;
    organization_id: string;
    site_id: string | null;
    content: string;
    position: number;
    tokens: string[];
  }> = [];
  let searchCount = 0;

  return {
    isConfigured: () => true,
    async checkConnection() {},
    async close() {},
    async transaction<T>(callback: (executor: Database) => Promise<T>): Promise<T> {
      const documentSnapshot = new Map(
        [...documents].map(([id, document]) => [id, { ...document }])
      );
      const versionSnapshot = versions.map((version) => ({ ...version }));
      const chunkSnapshot = chunks.map((chunk) => ({ ...chunk, tokens: [...chunk.tokens] }));
      try {
        return await callback(this);
      } catch (error) {
        documents.clear();
        for (const [id, document] of documentSnapshot) documents.set(id, document);
        versions.splice(0, versions.length, ...versionSnapshot);
        chunks.splice(0, chunks.length, ...chunkSnapshot);
        throw error;
      }
    },
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.toLowerCase();

      if (sql.includes('pg_advisory_xact_lock')) return result([]);

      if (sql.includes('select *') && sql.includes('source = $3')) {
        const found = [...documents.values()].find(
          (document) =>
            document.organization_id === values[0] &&
            document.site_id === values[1] &&
            document.source === values[2] &&
            document.status === 'active'
        );

        return result(found ? [found] : []);
      }

      if (sql.includes('insert into knowledge_documents')) {
        const existing = documents.get(String(values[0]));
        const row: KnowledgeDocument = {
          id: valueToString(values[0] ?? documentId),
          organization_id: valueToString(values[1]),
          site_id: values[2] ? valueToString(values[2]) : null,
          title: valueToString(values[3]),
          description: values[4] ? valueToString(values[4]) : null,
          category: valueToString(values[5]),
          type: valueToString(values[6]) as KnowledgeDocument['type'],
          language: valueToString(values[7]),
          version: Number(values[8]),
          size_bytes: Number(values[9]),
          hash: valueToString(values[10]),
          status: 'active',
          tags: values[11] as string[],
          author: values[12] ? valueToString(values[12]) : null,
          source: values[13] ? valueToString(values[13]) : 'manual',
          usage_count: existing?.usage_count ?? 0,
          created_at: existing?.created_at ?? new Date(),
          updated_at: new Date()
        };
        documents.set(row.id, row);
        return result([row]);
      }

      if (sql.includes('insert into knowledge_versions')) {
        versions.push({
          id: valueToString(values[0]),
          document_id: valueToString(values[1]),
          organization_id: valueToString(values[2]),
          version: Number(values[3]),
          title: valueToString(values[4]),
          content: valueToString(values[5]),
          hash: valueToString(values[6]),
          author: values[7] ? valueToString(values[7]) : null,
          created_at: new Date()
        });
        return result([]);
      }

      if (sql.includes('delete from knowledge_chunks')) {
        chunks.splice(
          0,
          chunks.length,
          ...chunks.filter((chunk) => chunk.document_id !== values[0])
        );
        return result([]);
      }

      if (sql.includes('insert into knowledge_chunks')) {
        if (options.failChunkInsert) throw new Error('chunk insert failure');
        chunks.push({
          id: valueToString(values[0]),
          document_id: valueToString(values[1]),
          organization_id: valueToString(values[2]),
          site_id: values[3] ? valueToString(values[3]) : null,
          content: valueToString(values[4]),
          position: Number(values[5]),
          tokens: values[6] as string[]
        });
        return result([]);
      }

      if (sql.includes('from knowledge_documents d') && sql.includes('order by d.updated_at')) {
        return result(
          [...documents.values()].filter(
            (document) => document.status !== 'deleted' && document.site_id === values[1]
          )
        );
      }

      if (sql.includes('from knowledge_chunks c')) {
        const queryTokens = values[2] as string[];
        const found = chunks
          .filter((chunk) => chunk.organization_id === values[0])
          .filter((chunk) => chunk.site_id === values[1])
          .filter((chunk) => chunk.tokens.some((token) => queryTokens.includes(token)))
          .map((chunk) => {
            const document = documents.get(chunk.document_id);
            return {
              document_id: chunk.document_id,
              title: document?.title ?? '',
              content: chunk.content,
              category: document?.category ?? 'general',
              language: document?.language ?? 'fr',
              source: document?.source ?? 'manual',
              score: '0.66'
            };
          });
        return result(found);
      }

      if (sql.includes('insert into knowledge_search_events')) {
        searchCount += 1;
        return result([]);
      }

      if (sql.includes('update knowledge_documents set usage_count')) {
        const document = documents.get(valueToString(values[0]));
        if (document) document.usage_count += 1;
        return result([]);
      }

      if (sql.includes('from knowledge_versions')) {
        return result(versions.filter((version) => version.document_id === values[0]));
      }

      if (sql.includes("set status = 'archived'")) {
        const document = documents.get(valueToString(values[0]));
        if (!document) return result([]);
        document.status = 'archived';
        return result([document]);
      }

      if (sql.includes("set status = 'deleted'")) {
        const document = documents.get(valueToString(values[0]));
        if (document) document.status = 'deleted';
        return { ...result([]), rowCount: document ? 1 : 0 };
      }

      if (sql.includes('consulted_documents')) {
        return result([
          {
            documents: String(documents.size),
            total_size_bytes: '128',
            searches: String(searchCount),
            consulted_documents: '1',
            never_used_documents: '0'
          }
        ]);
      }

      if (sql.includes('group by category')) {
        return result([{ category: 'services', count: '1' }]);
      }

      return result([]);
    }
  };
}

function createSimplePdf(text: string): Buffer {
  return Buffer.from(
    `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 720 Td (${text}) Tj ET
endstream
endobj
trailer
<< /Root 1 0 R /Title (Guide PDF) >>
%%EOF`,
    'latin1'
  );
}

function createSimpleDocx(text: string): Buffer {
  return createZip([
    {
      name: 'word/document.xml',
      content: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`
      )
    },
    {
      name: 'docProps/core.xml',
      content: Buffer.from(
        '<cp:coreProperties xmlns:cp="x" xmlns:dc="x"><dc:title>Guide DOCX</dc:title><dc:creator>Admin</dc:creator></cp:coreProperties>'
      )
    }
  ]);
}

function createZip(files: Array<{ name: string; content: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  for (const file of files) {
    const name = Buffer.from(file.name);
    const compressed = deflateRawSync(file.content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(file.content.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    parts.push(header, name, compressed);
  }

  return Buffer.concat(parts);
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

function valueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  throw new Error('Expected scalar test value');
}

function createMemoryBusinessConfigEngine(config: BusinessConfig): BusinessConfigEngine {
  return {
    async loadAll() {},
    async resolveConfig() {
      return config;
    },
    async getConfig() {
      return config;
    },
    async list(): Promise<BusinessConfigSummary[]> {
      return [];
    },
    async reload() {},
    async saveConfig() {
      return config;
    },
    async importConfig() {
      return config;
    },
    async exportConfig() {
      return config;
    },
    async listHistory() {
      return [];
    }
  };
}

const testConfig: BusinessConfig = {
  id: 'test-config',
  version: '1.0.0',
  identity: { name: 'Test', description: 'Test', category: 'test', colors: {} },
  contact: { openingHours: [] },
  personality: {
    tone: 'professional',
    style: 'clear',
    formalityLevel: 'neutral',
    vocabulary: [],
    defaultLanguage: 'fr',
    availableLanguages: ['fr']
  },
  goals: ['lead_generation'],
  restrictions: { never: [], always: [] },
  faq: [],
  knowledgeBase: [],
  rules: [],
  widget: { welcomeMessage: 'Bonjour.', fallbackMessage: 'Contactez-nous.', quickReplies: [] }
};
