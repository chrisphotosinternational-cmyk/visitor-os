import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import {
  analyzeSiteContent,
  type IntelligenceSourcePage
} from './site-intelligence-analyzer.js';
import type { SiteIntelligenceReport } from './site-intelligence-types.js';

type SourceRow = {
  document_id: string;
  title: string;
  source: string;
  chunk_id: string;
  position: number;
  content: string;
};

export class SiteIntelligenceService {
  constructor(private readonly database: Database) {}

  async analyzeAndStore(input: {
    organizationId: string;
    siteId: string;
  }): Promise<SiteIntelligenceReport> {
    const pages = await this.loadPages(input.organizationId, input.siteId);
    const report = analyzeSiteContent({ ...input, pages });
    await this.database.query(
      `
      insert into site_intelligence_reports (
        id, organization_id, site_id, report, page_count, chunk_count, created_at
      ) values ($1, $2, $3, $4::jsonb, $5, $6, $7)
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId,
        JSON.stringify(report),
        report.pageCount,
        report.chunkCount,
        report.generatedAt
      ]
    );
    return report;
  }

  async latest(input: {
    organizationId: string;
    siteId: string;
  }): Promise<SiteIntelligenceReport | null> {
    const result = await this.database.query<{ report: SiteIntelligenceReport }>(
      `
      select report
      from site_intelligence_reports
      where organization_id = $1 and site_id = $2
      order by created_at desc
      limit 1
      `,
      [input.organizationId, input.siteId]
    );
    return result.rows[0]?.report ?? null;
  }

  private async loadPages(organizationId: string, siteId: string): Promise<IntelligenceSourcePage[]> {
    const result = await this.database.query<SourceRow>(
      `
      select
        d.id as document_id,
        d.title,
        d.source,
        c.id as chunk_id,
        c.position,
        c.content
      from knowledge_documents d
      join knowledge_chunks c on c.document_id = d.id
      where d.organization_id = $1
        and d.site_id = $2
        and d.status = 'active'
      order by d.source, c.position
      `,
      [organizationId, siteId]
    );
    const pages = new Map<string, IntelligenceSourcePage>();
    for (const row of result.rows) {
      const page = pages.get(row.document_id) ?? {
        documentId: row.document_id,
        title: row.title,
        source: row.source,
        chunks: []
      };
      page.chunks.push({
        chunkId: row.chunk_id,
        position: row.position,
        content: row.content
      });
      pages.set(row.document_id, page);
    }
    return [...pages.values()];
  }
}
