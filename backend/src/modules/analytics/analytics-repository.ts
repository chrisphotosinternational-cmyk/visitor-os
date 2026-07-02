import { randomUUID } from 'node:crypto';
import type { Database } from '../../database/client.js';
import { percentage, roundMetric } from './analytics-period.js';
import type {
  AnalyticsDashboard,
  AnalyticsFilters,
  AnalyticsKpis,
  AnalyticsSitePerformance,
  AnalyticsSnapshotPeriod,
  AnalyticsSourceMetric,
  AnalyticsTagMetric,
  AnalyticsTimePoint
} from './analytics-types.js';

export class AnalyticsRepository {
  constructor(private readonly database: Database) {}

  async getDashboard(filters: AnalyticsFilters): Promise<AnalyticsDashboard> {
    const [
      baseCounts,
      scoreMetrics,
      followUpMetrics,
      decisionMetrics,
      aiMetrics,
      notificationMetrics,
      conversationsByDay,
      prospectsByDay,
      sitePerformance,
      topTags,
      responseSources
    ] = await Promise.all([
      this.getBaseCounts(filters),
      this.getScoreMetrics(filters),
      this.getFollowUpMetrics(filters),
      this.getDecisionMetrics(filters),
      this.getAiMetrics(filters),
      this.getNotificationMetrics(filters),
      this.getConversationsByDay(filters),
      this.getProspectsByDay(filters),
      this.getSitePerformance(filters),
      this.getTopTags(filters),
      this.getResponseSources(filters)
    ]);

    const kpis: AnalyticsKpis = {
      conversations: baseCounts.conversations,
      visitors: baseCounts.visitors,
      prospects: baseCounts.prospects,
      visitorToProspectRate: percentage(baseCounts.prospects, baseCounts.visitors),
      averageScore: scoreMetrics.averageScore,
      hotProspects: scoreMetrics.hotProspects,
      followUpsToday: followUpMetrics.today,
      followUpsOverdue: followUpMetrics.overdue,
      fallbackRate: decisionMetrics.fallbackRate,
      humanEscalationRate: decisionMetrics.humanEscalationRate,
      aiEstimatedCost: aiMetrics.estimatedCost,
      notificationsSent: notificationMetrics.sent,
      importantErrors: notificationMetrics.importantErrors
    };

    return {
      period: filters,
      kpis,
      conversationsByDay,
      prospectsByDay,
      sitePerformance,
      topTags,
      responseSources
    };
  }

  async exportRows(filters: AnalyticsFilters): Promise<Array<Record<string, string | number>>> {
    const dashboard = await this.getDashboard(filters);

    return [
      { Section: 'KPI', Metric: 'Conversations', Value: dashboard.kpis.conversations },
      { Section: 'KPI', Metric: 'Visitors', Value: dashboard.kpis.visitors },
      { Section: 'KPI', Metric: 'Prospects', Value: dashboard.kpis.prospects },
      {
        Section: 'KPI',
        Metric: 'Visitor to prospect rate',
        Value: dashboard.kpis.visitorToProspectRate
      },
      { Section: 'KPI', Metric: 'Average score', Value: dashboard.kpis.averageScore },
      { Section: 'KPI', Metric: 'Hot prospects', Value: dashboard.kpis.hotProspects },
      { Section: 'KPI', Metric: 'Follow-ups today', Value: dashboard.kpis.followUpsToday },
      { Section: 'KPI', Metric: 'Follow-ups overdue', Value: dashboard.kpis.followUpsOverdue },
      { Section: 'KPI', Metric: 'Fallback rate', Value: dashboard.kpis.fallbackRate },
      {
        Section: 'KPI',
        Metric: 'Human escalation rate',
        Value: dashboard.kpis.humanEscalationRate
      },
      { Section: 'KPI', Metric: 'AI estimated cost', Value: dashboard.kpis.aiEstimatedCost },
      { Section: 'KPI', Metric: 'Notifications sent', Value: dashboard.kpis.notificationsSent },
      { Section: 'KPI', Metric: 'Important errors', Value: dashboard.kpis.importantErrors },
      ...dashboard.sitePerformance.map((site) => ({
        Section: 'Site',
        Metric: site.siteName,
        Value: site.conversations,
        Prospects: site.prospects,
        Conversion: site.conversionRate,
        AverageScore: site.averageScore
      })),
      ...dashboard.topTags.map((tag) => ({
        Section: 'Tag',
        Metric: tag.label,
        Value: tag.count
      })),
      ...dashboard.responseSources.map((source) => ({
        Section: 'Source',
        Metric: source.source,
        Value: source.count,
        Rate: source.rate
      }))
    ];
  }

  async createSnapshot(input: {
    organizationId: string;
    siteId?: string;
    periodType: AnalyticsSnapshotPeriod;
    periodStart: string;
    periodEnd: string;
    metrics: AnalyticsDashboard;
  }): Promise<void> {
    await this.database.query(
      `
      insert into analytics_snapshots (
        id,
        organization_id,
        site_id,
        period_type,
        period_start,
        period_end,
        metrics
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb)
      on conflict (organization_id, site_id, period_type, period_start)
      do update set
        period_end = excluded.period_end,
        metrics = excluded.metrics,
        created_at = now()
      `,
      [
        randomUUID(),
        input.organizationId,
        input.siteId ?? null,
        input.periodType,
        input.periodStart,
        input.periodEnd,
        JSON.stringify(input.metrics)
      ]
    );
  }

  async countSnapshots(organizationId: string): Promise<number> {
    const result = await this.database.query<{ count: string }>(
      `select count(*)::text as count from analytics_snapshots where organization_id = $1`,
      [organizationId]
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async getBaseCounts(filters: AnalyticsFilters) {
    const result = await this.database.query<{
      conversations: string;
      visitors: string;
      prospects: string;
    }>(
      `
      select
        (select count(*)::text from conversations c where ${whereClause('c')}) as conversations,
        (
          select count(distinct v.id)::text
          from visitors v
          where
            ($1::uuid is null or v.organization_id = $1)
            and ($2::uuid is null or v.site_id = $2)
            and v.first_seen_at >= $3::timestamptz
            and v.first_seen_at < $4::timestamptz
        ) as visitors,
        (select count(*)::text from prospects p where ${whereClause('p')}) as prospects
      `,
      values(filters)
    );
    const row = result.rows[0];

    return {
      conversations: Number(row?.conversations ?? 0),
      visitors: Number(row?.visitors ?? 0),
      prospects: Number(row?.prospects ?? 0)
    };
  }

  private async getScoreMetrics(filters: AnalyticsFilters) {
    const result = await this.database.query<{
      average_score: string | null;
      hot_prospects: string;
    }>(
      `
      select
        avg(p.score_current)::text as average_score,
        count(*) filter (where p.score_current >= 70)::text as hot_prospects
      from prospects p
      where ${whereClause('p')}
      `,
      values(filters)
    );
    const row = result.rows[0];

    return {
      averageScore: roundMetric(Number(row?.average_score ?? 0)),
      hotProspects: Number(row?.hot_prospects ?? 0)
    };
  }

  private async getFollowUpMetrics(filters: AnalyticsFilters) {
    const result = await this.database.query<{ today: string; overdue: string }>(
      `
      select
        count(*) filter (where f.status = 'pending' and f.due_at::date = current_date)::text as today,
        count(*) filter (where f.status = 'pending' and f.due_at < now())::text as overdue
      from follow_ups f
      where
        ($1::uuid is null or f.organization_id = $1)
        and ($2::uuid is null or exists (
          select 1 from prospects p where p.id = f.prospect_id and p.site_id = $2
        ))
        and f.created_at >= $3::timestamptz
        and f.created_at < $4::timestamptz
      `,
      values(filters)
    );
    const row = result.rows[0];

    return {
      today: Number(row?.today ?? 0),
      overdue: Number(row?.overdue ?? 0)
    };
  }

  private async getDecisionMetrics(filters: AnalyticsFilters) {
    const result = await this.database.query<{
      total: string;
      fallback: string;
      escalated: string;
    }>(
      `
      select
        count(*)::text as total,
        count(*) filter (where d.source = 'fallback')::text as fallback,
        count(*) filter (where d.should_escalate)::text as escalated
      from decision_events d
      join conversations c on c.id = d.conversation_id
      where
        ($1::uuid is null or d.organization_id = $1)
        and ($2::uuid is null or c.site_id = $2)
        and d.created_at >= $3::timestamptz
        and d.created_at < $4::timestamptz
      `,
      values(filters)
    );
    const row = result.rows[0];
    const total = Number(row?.total ?? 0);

    return {
      fallbackRate: percentage(Number(row?.fallback ?? 0), total),
      humanEscalationRate: percentage(Number(row?.escalated ?? 0), total)
    };
  }

  private async getAiMetrics(filters: AnalyticsFilters) {
    const result = await this.database.query<{ estimated_cost: string | null }>(
      `
      select coalesce(sum(a.estimated_cost), 0)::text as estimated_cost
      from ai_events a
      where
        ($1::uuid is null or a.organization_id = $1)
        and ($2::uuid is null or a.site_id = $2)
        and a.created_at >= $3::timestamptz
        and a.created_at < $4::timestamptz
      `,
      values(filters)
    );

    return { estimatedCost: roundMetric(Number(result.rows[0]?.estimated_cost ?? 0)) };
  }

  private async getNotificationMetrics(filters: AnalyticsFilters) {
    const result = await this.database.query<{ sent: string; important_errors: string }>(
      `
      select
        count(*) filter (where n.status = 'sent')::text as sent,
        count(*) filter (
          where n.status = 'failed'
             or n.type in ('system_error', 'ai_provider_unavailable')
        )::text as important_errors
      from notification_events n
      where
        ($1::uuid is null or n.organization_id = $1)
        and ($2::uuid is null or n.site_id = $2)
        and n.created_at >= $3::timestamptz
        and n.created_at < $4::timestamptz
      `,
      values(filters)
    );
    const row = result.rows[0];

    return {
      sent: Number(row?.sent ?? 0),
      importantErrors: Number(row?.important_errors ?? 0)
    };
  }

  private async getConversationsByDay(filters: AnalyticsFilters): Promise<AnalyticsTimePoint[]> {
    return this.getByDay('conversations', 'c', filters);
  }

  private async getProspectsByDay(filters: AnalyticsFilters): Promise<AnalyticsTimePoint[]> {
    return this.getByDay('prospects', 'p', filters);
  }

  private async getByDay(
    table: 'conversations' | 'prospects',
    alias: 'c' | 'p',
    filters: AnalyticsFilters
  ): Promise<AnalyticsTimePoint[]> {
    const result = await this.database.query<{ date: string; count: string }>(
      `
      select date_trunc('day', ${alias}.created_at)::date::text as date,
             count(*)::text as count
      from ${table} ${alias}
      where ${whereClause(alias)}
      group by 1
      order by 1 asc
      `,
      values(filters)
    );

    return result.rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  }

  private async getSitePerformance(filters: AnalyticsFilters): Promise<AnalyticsSitePerformance[]> {
    const result = await this.database.query<{
      site_id: string;
      site_name: string;
      conversations: string;
      prospects: string;
      visitors: string;
      average_score: string | null;
    }>(
      `
      select
        s.id as site_id,
        s.name as site_name,
        count(distinct c.id)::text as conversations,
        count(distinct p.id)::text as prospects,
        count(distinct v.id)::text as visitors,
        avg(p.score_current)::text as average_score
      from sites s
      left join conversations c
        on c.site_id = s.id
       and c.created_at >= $3::timestamptz
       and c.created_at < $4::timestamptz
      left join prospects p
        on p.site_id = s.id
       and p.created_at >= $3::timestamptz
       and p.created_at < $4::timestamptz
      left join visitors v
        on v.site_id = s.id
       and v.first_seen_at >= $3::timestamptz
       and v.first_seen_at < $4::timestamptz
      where
        ($1::uuid is null or s.organization_id = $1)
        and ($2::uuid is null or s.id = $2)
      group by s.id, s.name
      order by prospects desc, conversations desc
      limit 20
      `,
      values(filters)
    );

    return result.rows.map((row) => {
      const prospects = Number(row.prospects);
      const visitors = Number(row.visitors);

      return {
        siteId: row.site_id,
        siteName: row.site_name,
        conversations: Number(row.conversations),
        prospects,
        averageScore: roundMetric(Number(row.average_score ?? 0)),
        conversionRate: percentage(prospects, visitors)
      };
    });
  }

  private async getTopTags(filters: AnalyticsFilters): Promise<AnalyticsTagMetric[]> {
    const result = await this.database.query<{ label: string; slug: string; count: string }>(
      `
      select t.label, t.slug, count(*)::text as count
      from prospect_tags pt
      join crm_tags t on t.id = pt.tag_id
      join prospects p on p.id = pt.prospect_id
      where ${whereClause('p')}
      group by t.label, t.slug
      order by count(*) desc, t.label asc
      limit 10
      `,
      values(filters)
    );

    return result.rows.map((row) => ({
      label: row.label,
      slug: row.slug,
      count: Number(row.count)
    }));
  }

  private async getResponseSources(filters: AnalyticsFilters): Promise<AnalyticsSourceMetric[]> {
    const result = await this.database.query<{ source: string; count: string }>(
      `
      select d.source, count(*)::text as count
      from decision_events d
      join conversations c on c.id = d.conversation_id
      where
        ($1::uuid is null or d.organization_id = $1)
        and ($2::uuid is null or c.site_id = $2)
        and d.created_at >= $3::timestamptz
        and d.created_at < $4::timestamptz
      group by d.source
      order by count(*) desc
      `,
      values(filters)
    );
    const total = result.rows.reduce((sum, row) => sum + Number(row.count), 0);

    return result.rows.map((row) => ({
      source: row.source,
      count: Number(row.count),
      rate: percentage(Number(row.count), total)
    }));
  }
}

function whereClause(alias: string): string {
  return `
    ($1::uuid is null or ${alias}.organization_id = $1)
    and ($2::uuid is null or ${alias}.site_id = $2)
    and ${alias}.created_at >= $3::timestamptz
    and ${alias}.created_at < $4::timestamptz
  `;
}

function values(filters: AnalyticsFilters): [string | null, string | null, string, string] {
  return [filters.organizationId ?? null, filters.siteId ?? null, filters.from, filters.to];
}
