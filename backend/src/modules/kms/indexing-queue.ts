import { randomUUID } from 'node:crypto';
import type { KnowledgeImporter } from './knowledge-importer.js';
import type {
  KnowledgeFileImportInput,
  KnowledgeImportReport,
  KnowledgeIndexingJob
} from './knowledge-types.js';

export class KnowledgeIndexingQueue {
  private readonly jobs = new Map<string, KnowledgeIndexingJob>();

  constructor(private readonly importer: KnowledgeImporter) {}

  async enqueueFileImport(input: KnowledgeFileImportInput): Promise<{
    job: KnowledgeIndexingJob;
    report: KnowledgeImportReport;
  }> {
    const job: KnowledgeIndexingJob = {
      id: randomUUID(),
      status: 'queued',
      fileName: input.fileName,
      organizationId: input.organizationId,
      siteId: input.siteId,
      createdAt: new Date()
    };
    this.jobs.set(job.id, job);

    try {
      job.status = 'processing';
      job.startedAt = new Date();
      const report = await this.importer.importFile(input);
      job.status = 'completed';
      job.documentId = report.document.id;
      job.completedAt = new Date();

      return { job: { ...job }, report };
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown indexing error';
      job.completedAt = new Date();
      throw error;
    }
  }

  list(organizationId: string, siteId?: string): KnowledgeIndexingJob[] {
    return [...this.jobs.values()]
      .filter((job) => job.organizationId === organizationId)
      .filter((job) => !siteId || job.siteId === siteId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 50)
      .map((job) => ({ ...job }));
  }
}
