import type { KnowledgeSearch } from '../kms/knowledge-search.js';
import type { KnowledgeSearchInput, KnowledgeSearchResult } from '../kms/knowledge-types.js';
import type { SiteIntelligenceService } from '../site-intelligence/site-intelligence-service.js';
import type {
  SiteContentType,
  SiteIntelligenceReport,
  SitePageType
} from '../site-intelligence/site-intelligence-types.js';
import { detectRetrievalIntent } from './intent-detector.js';
import type {
  IntelligentRetrievalBonuses,
  IntelligentRetrievalTrace,
  RankedRetrievalCandidate,
  RetrievalIntent
} from './intelligent-retrieval-types.js';

const PREFERENCES: Record<
  RetrievalIntent,
  { categories: SiteContentType[]; pages: SitePageType[] }
> = {
  pricing: { categories: ['prix', 'tableau', 'prestation'], pages: ['tarifs', 'prestation'] },
  prestation: {
    categories: ['prestation', 'duree', 'nombre_photos', 'retouches'],
    pages: ['prestation']
  },
  reservation: { categories: ['formulaire', 'CTA', 'acompte'], pages: ['reservation', 'contact'] },
  preparation: { categories: ['prestation', 'FAQ'], pages: ['guide', 'FAQ', 'prestation'] },
  deplacement: { categories: ['deplacement'], pages: ['tarifs', 'prestation', 'FAQ'] },
  confidentialite: { categories: ['confidentialite'], pages: ['mentions_legales', 'FAQ'] },
  paiement: { categories: ['paiement', 'acompte', 'prix'], pages: ['tarifs', 'CGV'] },
  contact: { categories: ['telephone', 'email', 'horaires', 'formulaire'], pages: ['contact'] },
  portfolio: { categories: ['galerie'], pages: ['portfolio'] },
  FAQ: { categories: ['FAQ'], pages: ['FAQ'] },
  studio: { categories: ['studio'], pages: ['prestation', 'contact'] },
  video: { categories: ['video'], pages: ['portfolio', 'prestation'] },
  avis: { categories: ['avis_client'], pages: ['accueil', 'prestation'] },
  general: { categories: [], pages: [] }
};

export class IntelligentRetrievalEngine implements KnowledgeSearch {
  constructor(
    private readonly searchEngine: KnowledgeSearch,
    private readonly siteIntelligence: SiteIntelligenceService,
    private readonly bonuses: IntelligentRetrievalBonuses,
    private readonly enabled = true
  ) {}

  async search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult[]> {
    const trace = await this.inspect(input);
    return trace.candidates.map((candidate) => ({
      documentId: candidate.documentId,
      title: candidate.title,
      content: candidate.content,
      category: candidate.category,
      language: candidate.language,
      score: candidate.score,
      relevance: candidate.relevance,
      source: candidate.source
    }));
  }

  async inspect(input: KnowledgeSearchInput): Promise<IntelligentRetrievalTrace> {
    const candidates = await this.searchEngine.search(input);
    const intent = detectRetrievalIntent(input.query);
    const preference = PREFERENCES[intent];
    if (!this.enabled || intent === 'general' || candidates.length < 2) {
      return {
        intent,
        categories: preference.categories,
        preferredPageTypes: preference.pages,
        enabled: this.enabled,
        candidates: unchanged(candidates)
      };
    }
    const report = await this.siteIntelligence.latest(input).catch(() => null);
    if (!report) {
      return {
        intent,
        categories: preference.categories,
        preferredPageTypes: preference.pages,
        enabled: this.enabled,
        candidates: unchanged(candidates, 'Aucun rapport Site Intelligence disponible.')
      };
    }
    const leadingScore = candidates[0]?.score ?? 0;
    const ranked = candidates.map((candidate, index) =>
      scoreCandidate(candidate, index, leadingScore, report, preference, this.bonuses)
    );
    ranked.sort((a, b) => b.scoreAfterBonus - a.scoreAfterBonus || a.originalRank - b.originalRank);
    ranked.forEach((candidate, index) => {
      candidate.rank = index + 1;
    });
    return {
      intent,
      categories: preference.categories,
      preferredPageTypes: preference.pages,
      enabled: true,
      candidates: ranked
    };
  }
}

function scoreCandidate(
  candidate: KnowledgeSearchResult,
  index: number,
  leadingScore: number,
  report: SiteIntelligenceReport,
  preference: { categories: SiteContentType[]; pages: SitePageType[] },
  bonuses: IntelligentRetrievalBonuses
): RankedRetrievalCandidate {
  const page = report.pages.find((item) => item.documentId === candidate.documentId);
  const detected = report.chunks
    .filter(
      (chunk) =>
        chunk.documentId === candidate.documentId &&
        (candidate.content.includes(chunk.excerpt) ||
          chunk.excerpt.includes(candidate.content.slice(0, 80)))
    )
    .flatMap((chunk) => chunk.detections.map((detection) => detection.category));
  const applied: RankedRetrievalCandidate['bonusesApplied'] = [];
  const refused: RankedRetrievalCandidate['bonusesRefused'] = [];
  const isCloseCandidate = leadingScore - candidate.score <= bonuses.closeScoreThreshold;
  apply(
    'category',
    candidate.category,
    isCloseCandidate && preference.categories.includes(candidate.category as SiteContentType),
    bonuses.category,
    applied,
    refused
  );
  apply(
    'page_type',
    page?.type ?? 'unknown',
    isCloseCandidate && Boolean(page && preference.pages.includes(page.type)),
    bonuses.pageType,
    applied,
    refused
  );
  const block = preference.categories.find((category) => detected.includes(category));
  apply(
    'block_type',
    block ?? 'unknown',
    isCloseCandidate && Boolean(block),
    bonuses.blockType,
    applied,
    refused
  );
  const total = applied.reduce((sum, bonus) => sum + bonus.value, 0);
  return {
    ...candidate,
    originalRank: index + 1,
    rank: index + 1,
    scoreBeforeBonus: candidate.score,
    scoreAfterBonus: candidate.score + total,
    score: candidate.score + total,
    bonusesApplied: applied,
    bonusesRefused: refused,
    justification:
      total > 0
        ? `Bonus de ${total.toFixed(3)} appliqué selon l'intention et le rapport Site Intelligence.`
        : 'Classement conservé : aucune catégorie pertinente détectée.'
  };
}

function apply(
  kind: 'category' | 'page_type' | 'block_type',
  category: string,
  accepted: boolean,
  value: number,
  applied: RankedRetrievalCandidate['bonusesApplied'],
  refused: RankedRetrievalCandidate['bonusesRefused']
): void {
  if (accepted) applied.push({ kind, category, value });
  else
    refused.push({
      kind,
      category,
      reason: 'La catégorie ne correspond pas à l’intention détectée.'
    });
}

function unchanged(
  candidates: KnowledgeSearchResult[],
  reason = 'Reranking désactivé ou inutile.'
): RankedRetrievalCandidate[] {
  return candidates.map((candidate, index) => ({
    ...candidate,
    originalRank: index + 1,
    rank: index + 1,
    scoreBeforeBonus: candidate.score,
    scoreAfterBonus: candidate.score,
    bonusesApplied: [],
    bonusesRefused: [],
    justification: reason
  }));
}
