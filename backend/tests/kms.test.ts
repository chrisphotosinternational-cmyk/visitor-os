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
import type { KnowledgeDocument, KnowledgeVersion } from '../src/modules/kms/knowledge-types.js';
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
      title: 'Guide parking',
      category: 'access',
      type: 'markdown',
      content: 'Le parking est ouvert 24h/24.'
    });

    assert.equal(valid.language, 'fr');
    assert.throws(() => validator.validateImport({ title: '' }), /organizationId/);
  });

  it('indexes content into searchable chunks', () => {
    const chunks = new KnowledgeIndexer().createChunks({
      documentId,
      organizationId,
      content: 'Premier paragraphe.\n\nParking disponible proche.'
    });

    assert.equal(chunks.length, 2);
    assert.ok(chunks[1]?.tokens.includes('parking'));
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
    const versions = await repository.versions(document.id, organizationId);

    assert.equal(document.version, 1);
    assert.equal(results[0]?.documentId, document.id);
    assert.ok((results[0]?.score ?? 0) > 0);
    assert.equal(versions.length, 1);
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
      query: 'parking',
      limit: 5
    });

    assert.equal(forbidden.length, 0);
  });

  it('lists, archives, deletes and exposes statistics', async () => {
    const database = createKnowledgeDatabase();
    const repository = new KnowledgeRepository(database);
    const importer = new KnowledgeImporter(repository);
    const document = await importer.import({
      organizationId,
      title: 'FAQ petit dejeuner',
      category: 'services',
      type: 'txt',
      content: 'Le petit dejeuner est servi de 7h a 10h.'
    });

    assert.equal((await repository.list({ organizationId })).length, 1);
    assert.equal((await repository.archive(document.id, organizationId))?.status, 'archived');
    assert.equal(await repository.delete(document.id, organizationId), true);
    assert.equal((await repository.statistics(organizationId)).documents, 1);
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
});

const organizationId = '00000000-0000-4000-8000-000000000001';
const siteId = '00000000-0000-4000-8000-000000000101';
const documentId = '00000000-0000-4000-8000-000000000301';

function createKnowledgeDatabase(): Database {
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
    async checkConnection() {},
    async close() {},
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      const sql = text.toLowerCase();

      if (sql.includes('select *') && sql.includes('hash =')) {
        const found = [...documents.values()].find(
          (document) =>
            document.organization_id === values[0] &&
            (!values[1] || document.site_id === values[1]) &&
            (document.hash === values[2] ||
              (typeof values[3] === 'string' &&
                values[3].startsWith('file:') &&
                document.source === values[3])) &&
            document.status !== 'deleted'
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
        return result([...documents.values()].filter((document) => document.status !== 'deleted'));
      }

      if (sql.includes('from knowledge_chunks c')) {
        const queryTokens = values[2] as string[];
        const found = chunks
          .filter((chunk) => chunk.organization_id === values[0])
          .filter((chunk) => !values[1] || chunk.site_id === values[1])
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
