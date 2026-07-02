import type { KnowledgeRepository } from './knowledge-repository.js';
import type { KnowledgeSearchInput, KnowledgeSearchResult } from './knowledge-types.js';

export interface KnowledgeSearch {
  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult[]>;
}

export class RepositoryKnowledgeSearch implements KnowledgeSearch {
  constructor(private readonly repository: KnowledgeRepository) {}

  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult[]> {
    return this.repository.search(input);
  }
}
