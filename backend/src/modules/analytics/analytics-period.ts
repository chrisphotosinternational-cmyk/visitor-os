import type { AnalyticsFilters, AnalyticsPeriodPreset } from './analytics-types.js';

export function resolveAnalyticsPeriod(input: {
  preset?: AnalyticsPeriodPreset;
  from?: string;
  to?: string;
  now?: Date;
  organizationId?: string;
  siteId?: string;
}): AnalyticsFilters {
  const now = input.now ?? new Date();
  const preset = input.preset ?? '7d';
  const to = input.to ? new Date(input.to) : now;
  let from: Date;

  if (preset === 'custom') {
    from = input.from ? new Date(input.from) : startOfDay(now);
  } else if (preset === 'today') {
    from = startOfDay(now);
  } else if (preset === '30d') {
    from = addDays(startOfDay(now), -29);
  } else {
    from = addDays(startOfDay(now), -6);
  }

  const filters: AnalyticsFilters = {
    from: from.toISOString(),
    to: to.toISOString()
  };

  if (input.organizationId) {
    filters.organizationId = input.organizationId;
  }

  if (input.siteId) {
    filters.siteId = input.siteId;
  }

  return filters;
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;

  return Math.round((part / total) * 10_000) / 100;
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}
