import type { KnowledgeSearchResult } from '../kms/knowledge-types.js';
import type {
  SiteContentType,
  SitePageType
} from '../site-intelligence/site-intelligence-types.js';

export const retrievalIntents = [
  'pricing',
  'prestation',
  'reservation',
  'preparation',
  'deplacement',
  'confidentialite',
  'paiement',
  'contact',
  'portfolio',
  'FAQ',
  'studio',
  'video',
  'avis',
  'general'
] as const;
export type RetrievalIntent = (typeof retrievalIntents)[number];

export type IntelligentRetrievalBonuses = {
  category: number;
  pageType: number;
  blockType: number;
  closeScoreThreshold: number;
};

export type RetrievalBonus = {
  kind: 'category' | 'page_type' | 'block_type';
  category: string;
  value: number;
};
export type RankedRetrievalCandidate = KnowledgeSearchResult & {
  originalRank: number;
  rank: number;
  scoreBeforeBonus: number;
  scoreAfterBonus: number;
  bonusesApplied: RetrievalBonus[];
  bonusesRefused: Array<{ kind: RetrievalBonus['kind']; category: string; reason: string }>;
  justification: string;
};

export type IntelligentRetrievalTrace = {
  intent: RetrievalIntent;
  categories: SiteContentType[];
  preferredPageTypes: SitePageType[];
  enabled: boolean;
  timings: { searchMs: number; rerankingMs: number; totalMs: number };
  candidatesBeforeReranking: KnowledgeSearchResult[];
  candidates: RankedRetrievalCandidate[];
};

export type RetrievalBenchmarkReport = {
  id: string;
  organizationId: string;
  siteId: string;
  createdAt: string;
  baselineReportId: string;
  enhancedReportId: string;
  globalScoreDelta: number;
  categoryDeltas: Record<string, number>;
  errorDeltas: Record<string, number>;
  accepted: boolean;
};
