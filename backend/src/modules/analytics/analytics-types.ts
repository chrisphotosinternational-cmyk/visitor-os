export const analyticsPeriodPresets = ['today', '7d', '30d', 'custom'] as const;

export type AnalyticsPeriodPreset = (typeof analyticsPeriodPresets)[number];

export type AnalyticsFilters = {
  organizationId?: string;
  siteId?: string;
  from: string;
  to: string;
};

export type AnalyticsKpis = {
  conversations: number;
  visitors: number;
  prospects: number;
  visitorToProspectRate: number;
  averageScore: number;
  hotProspects: number;
  followUpsToday: number;
  followUpsOverdue: number;
  fallbackRate: number;
  humanEscalationRate: number;
  aiEstimatedCost: number;
  notificationsSent: number;
  importantErrors: number;
};

export type AnalyticsTimePoint = {
  date: string;
  count: number;
};

export type AnalyticsSitePerformance = {
  siteId: string;
  siteName: string;
  conversations: number;
  prospects: number;
  averageScore: number;
  conversionRate: number;
};

export type AnalyticsTagMetric = {
  label: string;
  slug: string;
  count: number;
};

export type AnalyticsSourceMetric = {
  source: string;
  count: number;
  rate: number;
};

export type AnalyticsDashboard = {
  period: AnalyticsFilters;
  kpis: AnalyticsKpis;
  conversationsByDay: AnalyticsTimePoint[];
  prospectsByDay: AnalyticsTimePoint[];
  sitePerformance: AnalyticsSitePerformance[];
  topTags: AnalyticsTagMetric[];
  responseSources: AnalyticsSourceMetric[];
};

export type AnalyticsSnapshotPeriod = 'daily' | 'weekly' | 'monthly';
