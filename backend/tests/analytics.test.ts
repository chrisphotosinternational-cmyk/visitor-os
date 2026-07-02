import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type pg from 'pg';
import type { Database } from '../src/database/client.js';
import { AnalyticsRepository } from '../src/modules/analytics/analytics-repository.js';
import { percentage, resolveAnalyticsPeriod } from '../src/modules/analytics/analytics-period.js';
import { toCsv, toSpreadsheetXml } from '../src/modules/crm/csv-export.js';

describe('Analytics Engine', () => {
  it('resolves common analytics periods', () => {
    const period = resolveAnalyticsPeriod({
      preset: '7d',
      now: new Date('2026-07-02T12:00:00.000Z'),
      organizationId: organizationId,
      siteId: siteId
    });

    assert.equal(period.organizationId, organizationId);
    assert.equal(period.siteId, siteId);
    assert.equal(period.from, '2026-06-26T00:00:00.000Z');
    assert.equal(period.to, '2026-07-02T12:00:00.000Z');
  });

  it('calculates conversion rates safely', () => {
    assert.equal(percentage(4, 10), 40);
    assert.equal(percentage(0, 0), 0);
  });

  it('aggregates conversations, prospects, score and period filters', async () => {
    const database = createAnalyticsDatabase();
    const analytics = new AnalyticsRepository(database);
    const dashboard = await analytics.getDashboard(baseFilters());

    assert.equal(dashboard.kpis.conversations, 8);
    assert.equal(dashboard.kpis.prospects, 4);
    assert.equal(dashboard.kpis.visitorToProspectRate, 40);
    assert.equal(dashboard.kpis.averageScore, 72.5);
    assert.equal(dashboard.kpis.hotProspects, 2);
    assert.equal(dashboard.kpis.fallbackRate, 25);
    assert.equal(dashboard.kpis.humanEscalationRate, 50);
    assert.equal(dashboard.conversationsByDay.length, 2);
    assert.equal(dashboard.prospectsByDay.length, 2);
    assert.equal(
      database.calls.every((call) => call.values[0] === organizationId),
      true
    );
    assert.equal(
      database.calls.every((call) => call.values[1] === siteId),
      true
    );
  });

  it('aggregates tags, sites, notifications and AI cost', async () => {
    const analytics = new AnalyticsRepository(createAnalyticsDatabase());
    const dashboard = await analytics.getDashboard(baseFilters());

    assert.equal(dashboard.sitePerformance[0]?.siteName, 'Site demo');
    assert.equal(dashboard.sitePerformance[0]?.conversionRate, 50);
    assert.equal(dashboard.topTags[0]?.slug, 'tarif');
    assert.equal(dashboard.responseSources[0]?.source, 'faq');
    assert.equal(dashboard.kpis.aiEstimatedCost, 0.12);
    assert.equal(dashboard.kpis.notificationsSent, 3);
    assert.equal(dashboard.kpis.importantErrors, 1);
  });

  it('exports analytics rows to CSV and spreadsheet XML', async () => {
    const analytics = new AnalyticsRepository(createAnalyticsDatabase());
    const rows = await analytics.exportRows(baseFilters());

    assert.match(toCsv(rows), /"Visitor to prospect rate"/);
    assert.match(toSpreadsheetXml(rows), /<Workbook/);
  });

  it('stores analytics snapshots', async () => {
    const database = createAnalyticsDatabase();
    const analytics = new AnalyticsRepository(database);
    const dashboard = await analytics.getDashboard(baseFilters());

    await analytics.createSnapshot({
      organizationId,
      siteId,
      periodType: 'daily',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-02',
      metrics: dashboard
    });

    assert.equal(await analytics.countSnapshots(organizationId), 1);
  });
});

const organizationId = '00000000-0000-4000-8000-000000000001';
const siteId = '00000000-0000-4000-8000-000000000101';

function baseFilters() {
  return {
    organizationId,
    siteId,
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-07-02T00:00:00.000Z'
  };
}

function createAnalyticsDatabase(): Database & {
  calls: Array<{ text: string; values: unknown[] }>;
} {
  let snapshotCount = 0;
  const calls: Array<{ text: string; values: unknown[] }> = [];

  return {
    calls,
    async checkConnection() {},
    async close() {},
    async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      text: string,
      values: unknown[] = []
    ): Promise<pg.QueryResult<T>> {
      calls.push({ text, values });
      const sql = text.toLowerCase();

      if (sql.includes('insert into analytics_snapshots')) {
        snapshotCount += 1;
        return result([]);
      }

      if (sql.includes('from analytics_snapshots')) {
        return result([{ count: String(snapshotCount) }]);
      }

      if (sql.includes('avg(p.score_current)') && sql.includes('hot_prospects')) {
        return result([{ average_score: '72.5', hot_prospects: '2' }]);
      }

      if (sql.includes('from follow_ups')) {
        return result([{ today: '1', overdue: '2' }]);
      }

      if (sql.includes('from decision_events') && sql.includes('fallback')) {
        return result([{ total: '4', fallback: '1', escalated: '2' }]);
      }

      if (sql.includes('from ai_events')) {
        return result([{ estimated_cost: '0.12' }]);
      }

      if (sql.includes('from notification_events')) {
        return result([{ sent: '3', important_errors: '1' }]);
      }

      if (sql.includes('from conversations') && sql.includes('date_trunc')) {
        return result([
          { date: '2026-07-01', count: '3' },
          { date: '2026-07-02', count: '5' }
        ]);
      }

      if (sql.includes('from prospects') && sql.includes('date_trunc')) {
        return result([
          { date: '2026-07-01', count: '1' },
          { date: '2026-07-02', count: '3' }
        ]);
      }

      if (sql.includes('from sites s')) {
        return result([
          {
            site_id: siteId,
            site_name: 'Site demo',
            conversations: '8',
            prospects: '4',
            visitors: '8',
            average_score: '72.5'
          }
        ]);
      }

      if (sql.includes('as conversations') && sql.includes('as visitors')) {
        return result([{ conversations: '8', visitors: '10', prospects: '4' }]);
      }

      if (sql.includes('from prospect_tags')) {
        return result([{ label: 'Tarif', slug: 'tarif', count: '3' }]);
      }

      if (sql.includes('group by d.source')) {
        return result([
          { source: 'faq', count: '3' },
          { source: 'fallback', count: '1' }
        ]);
      }

      return result([]);
    }
  };
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
