import { KnowledgeIndexer } from './knowledge-indexer.js';
import type { KnowledgeRepository } from './knowledge-repository.js';
import type {
  KnowledgeDocument,
  KnowledgeFileImportInput,
  KnowledgeImportInput,
  KnowledgeImportReport
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

  async import(input: KnowledgeImportInput): Promise<KnowledgeDocument> {
    const valid = this.validator.validateImport(input);
    const document = await this.repository.upsertDocument({
      organizationId: valid.organizationId,
      ...(valid.siteId ? { siteId: valid.siteId } : {}),
      title: valid.title,
      ...(valid.description ? { description: valid.description } : {}),
      category: valid.category,
      type: valid.type,
      language: valid.language,
      content: valid.content,
      tags: valid.tags,
      ...(valid.author ? { author: valid.author } : {}),
      source: valid.source
    });
    const chunks = this.indexer.createChunks({
      documentId: document.id,
      organizationId: document.organization_id,
      ...(document.site_id ? { siteId: document.site_id } : {}),
      content: valid.content
    });

    await this.repository.replaceChunks(document, chunks);

    return document;
  }

  async importFile(input: KnowledgeFileImportInput): Promise<KnowledgeImportReport> {
    const startedAt = performance.now();
    const extracted = this.extractor.extract(input);
    const document = await this.repository.upsertDocument({
      organizationId: input.organizationId,
      ...(input.siteId ? { siteId: input.siteId } : {}),
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
    });
    const chunks = this.indexer.createChunks({
      documentId: document.id,
      organizationId: document.organization_id,
      ...(document.site_id ? { siteId: document.site_id } : {}),
      content: extracted.text,
      ...(input.chunking ? { config: input.chunking } : {})
    });

    await this.repository.replaceChunks(document, chunks);

    return {
      document,
      extraction: extracted.metadata,
      chunks: chunks.length,
      warnings: extracted.warnings,
      durationMs: Math.round(performance.now() - startedAt)
    };
  }
}
