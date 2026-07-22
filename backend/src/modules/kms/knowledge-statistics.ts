import type { KnowledgeRepository } from './knowledge-repository.js';
import type { KnowledgeStatistics } from './knowledge-types.js';

export class KnowledgeStatisticsService {
  constructor(private readonly repository: KnowledgeRepository) {}

  get(organizationId: string, siteId: string): Promise<KnowledgeStatistics> {
    return this.repository.statistics(organizationId, siteId);
  }
}
