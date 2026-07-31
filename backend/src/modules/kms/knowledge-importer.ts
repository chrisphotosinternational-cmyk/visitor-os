import { KnowledgeIndexer } from './knowledge-indexer.js';
import type { KnowledgeRepository } from './knowledge-repository.js';
import type {
  KnowledgeFileImportInput,
  KnowledgeImportInput,
  KnowledgeImportReport,
  KnowledgeImportResult
} from './knowledge-types.js';
import { KnowledgeValidator } from './knowledge-validator.js';
import { KnowledgeDocumentExtractor } from './document-extractor.js';

export class KnowledgeImporter {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly validator = new KnowledgeValidator(),
    private readonly indexer = new KnowledgeIndexer(),
    private readonly extractor = new KnowledgeDocumentExtractor()
  ) {}

  async import(input: KnowledgeImportInput): Promise<KnowledgeImportResult> {
    const valid = this.validator.validateImport(input);
    const imported = await this.repository.importDocument(
      {
        organizationId: valid.organizationId,
        siteId: valid.siteId,
        title: valid.title,
        ...(valid.description ? { description: valid.description } : {}),
        category: valid.category,
        type: valid.type,
        language: valid.language,
        content: valid.content,
        tags: valid.tags,
        ...(valid.author ? { author: valid.author } : {}),
        source: valid.source
      },
      (document) =>
        this.indexer.createChunks({
          documentId: document.id,
          organizationId: document.organization_id,
          siteId: valid.siteId,
          content: valid.content
        })
    );

    return { document: imported.document, chunks: imported.chunksCreated };
  }

  async importFile(input: KnowledgeFileImportInput): Promise<KnowledgeImportReport> {
    const startedAt = performance.now();
    const extracted = this.extractor.extract(input);
    const imported = await this.repository.importDocument(
      {
        organizationId: input.organizationId,
        siteId: input.siteId,
        title: input.title ?? extracted.metadata.title ?? input.fileName,
        ...(input.description ? { description: input.description } : {}),
        category: input.category ?? 'general',
        type: extracted.metadata.detectedType,
        language: input.language ?? 'fr',
        content: extracted.text,
        tags: input.tags ?? [],
        ...(input.author || extracted.metadata.author
          ? { author: input.author ?? extracted.metadata.author }
          : {}),
        source: `file:${input.fileName}`
      },
      (document) =>
        this.indexer.createChunks({
          documentId: document.id,
          organizationId: document.organization_id,
          siteId: input.siteId,
          content: extracted.text,
          ...(input.chunking ? { config: input.chunking } : {})
        })
    );

    return {
      document: imported.document,
      extraction: extracted.metadata,
      chunks: imported.chunksCreated,
      warnings: extracted.warnings,
      durationMs: Math.round(performance.now() - startedAt)
    };
  }
}
