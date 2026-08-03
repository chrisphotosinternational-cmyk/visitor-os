import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import type { VisitorEvaluationService } from '../visitor-evaluation/visitor-evaluation-service.js';
import type { VisitorEvaluationReport } from '../visitor-evaluation/visitor-evaluation-types.js';
import type { RetrievalBenchmarkReport } from './intelligent-retrieval-types.js';

export class RetrievalBenchmarkService {
  constructor(
    private readonly database: Database,
    private readonly baseline: VisitorEvaluationService,
    private readonly enhanced: VisitorEvaluationService
  ) {}

  async runAndStore(input: {
    organizationId: string;
    siteId: string;
  }): Promise<RetrievalBenchmarkReport> {
    const baseline = await this.baseline.evaluateAndStore(input);
    const enhanced = await this.enhanced.evaluateAndStore(input);
    const report = compareReports(input, baseline, enhanced);
    await this.database.query(
      `insert into intelligent_retrieval_benchmarks
       (id, organization_id, site_id, baseline_report_id, enhanced_report_id, report, accepted, created_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
      [
        report.id,
        report.organizationId,
        report.siteId,
        report.baselineReportId,
        report.enhancedReportId,
        JSON.stringify(report),
        report.accepted,
        report.createdAt
      ]
    );
    if (!report.accepted) {
      throw new Error('Intelligent retrieval benchmark rejected: a regression was detected');
    }
    return report;
  }

  async latest(input: {
    organizationId: string;
    siteId: string;
  }): Promise<RetrievalBenchmarkReport | null> {
    const result = await this.database.query<{ report: RetrievalBenchmarkReport }>(
      `select report from intelligent_retrieval_benchmarks where organization_id=$1 and site_id=$2
       order by created_at desc limit 1`,
      [input.organizationId, input.siteId]
    );
    return result.rows[0]?.report ?? null;
  }
}

export function compareReports(
  input: { organizationId: string; siteId: string },
  baseline: VisitorEvaluationReport,
  enhanced: VisitorEvaluationReport
): RetrievalBenchmarkReport {
  const categories = new Set(
    [...baseline.scoresByCategory, ...enhanced.scoresByCategory].map((item) => item.category)
  );
  const categoryDeltas = Object.fromEntries(
    [...categories].map((category) => [
      category,
      score(enhanced, category) - score(baseline, category)
    ])
  );
  const issues = new Set([
    ...Object.keys(baseline.issueCounts),
    ...Object.keys(enhanced.issueCounts)
  ]);
  const errorDeltas = Object.fromEntries(
    [...issues].map((issue) => [
      issue,
      (enhanced.issueCounts[issue as keyof typeof enhanced.issueCounts] ?? 0) -
        (baseline.issueCounts[issue as keyof typeof baseline.issueCounts] ?? 0)
    ])
  );
  const globalScoreDelta = Number((enhanced.globalScore - baseline.globalScore).toFixed(1));
  const accepted =
    globalScoreDelta >= 0 &&
    Object.values(categoryDeltas).every((delta) => delta >= 0) &&
    Object.values(errorDeltas).every((delta) => delta <= 0);
  return {
    id: randomUUID(),
    organizationId: input.organizationId,
    siteId: input.siteId,
    createdAt: new Date().toISOString(),
    baselineReportId: baseline.id,
    enhancedReportId: enhanced.id,
    globalScoreDelta,
    categoryDeltas,
    errorDeltas,
    accepted
  };
}

function score(report: VisitorEvaluationReport, category: string): number {
  return report.scoresByCategory.find((item) => item.category === category)?.score ?? 0;
}
