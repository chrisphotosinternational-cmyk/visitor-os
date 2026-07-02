import { KnowledgeIndexer } from './knowledge-indexer.js';
import type { KnowledgeRepository } from './knowledge-repository.js';
import type { KnowledgeDocument, KnowledgeImportInput } from './knowledge-types.js';
import { KnowledgeValidator } from './knowledge-validator.js';

export class KnowledgeImporter {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly validator = new KnowledgeValidator(),
    private readonly indexer = new KnowledgeIndexer()
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
}
