import {
  siteContentTypes,
  sitePageTypes,
  type IntelligenceDetection,
  type SiteContentType,
  type SiteIntelligenceChunk,
  type SiteIntelligencePage,
  type SiteIntelligenceReport,
  type SitePageType
} from './site-intelligence-types.js';

export type IntelligenceSourcePage = {
  documentId: string;
  title: string;
  source: string;
  chunks: Array<{ chunkId: string; position: number; content: string }>;
};

const pageSignals: ReadonlyArray<{
  type: SitePageType;
  patterns: RegExp[];
  urlWeight?: number;
}> = [
  { type: 'mentions_legales', patterns: [/mentions?[-_ ]l[eé]gales?/i, /politique de confidentialit[eé]/i], urlWeight: 5 },
  { type: 'CGV', patterns: [/\bcgv\b/i, /conditions? g[eé]n[eé]rales? de vente/i], urlWeight: 5 },
  { type: 'reservation', patterns: [/r[eé]serv/i, /prendre rendez[- ]vous/i, /calendrier/i], urlWeight: 4 },
  { type: 'tarifs', patterns: [/tarifs?/i, /\bprix\b/i, /formules?/i, /\d+[,.]?\d*\s*(?:€|euros?)/i], urlWeight: 4 },
  { type: 'FAQ', patterns: [/\bfaq\b/i, /questions? fr[eé]quentes?/i, /FAQ Question:/i], urlWeight: 4 },
  { type: 'contact', patterns: [/contact/i, /nous joindre/i, /t[eé]l[eé]phone/i, /@[a-z0-9.-]+\.[a-z]{2,}/i], urlWeight: 4 },
  { type: 'portfolio', patterns: [/portfolio/i, /galerie/i, /r[eé]alisations?/i], urlWeight: 4 },
  { type: 'guide', patterns: [/\bguide\b/i, /comment choisir/i, /conseils?/i], urlWeight: 3 },
  { type: 'article', patterns: [/\bblog\b/i, /\barticle\b/i, /publi[eé] le/i], urlWeight: 3 },
  { type: 'prestation', patterns: [/prestations?/i, /services?/i, /s[eé]ance/i, /accompagnement/i], urlWeight: 2 }
];

const contentSignals: Record<SiteContentType, RegExp[]> = {
  prix: [/\d+[,.]?\d*\s*(?:€|euros?)/i, /tarifs?/i, /\bprix\b/i],
  duree: [/\d+\s*(?:h|heures?|minutes?|jours?)/i, /dur[eé]e/i],
  prestation: [/prestations?/i, /services?/i, /s[eé]ance/i, /formules?/i],
  retouches: [/retouch/i, /post[- ]production/i],
  nombre_photos: [/\d+\s*(?:photos?|images?)/i, /nombre de photos/i, /photos? livr[eé]es?/i],
  paiement: [/paiement/i, /r[eè]glement/i, /carte bancaire/i, /virement/i],
  acompte: [/acompte/i, /arrhes/i],
  deplacement: [/d[eé]placement/i, /frais kilom[eé]triques?/i, /\bkm\b/i],
  confidentialite: [/confidentialit[eé]/i, /donn[eé]es personnelles/i, /\bRGPD\b/i],
  studio: [/\bstudio\b/i],
  telephone: [/(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/i, /t[eé]l[eé]phone/i],
  email: [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, /\be-?mail\b/i],
  horaires: [/horaires?/i, /ouvert(?:ure)?/i, /\d{1,2}\s*h\s*\d{0,2}/i],
  formulaire: [/formulaire/i, /champs? obligatoire/i, /envoyer votre demande/i],
  CTA: [/r[eé]servez/i, /contactez[- ]nous/i, /demandez un devis/i, /prendre rendez[- ]vous/i],
  avis_client: [/avis clients?/i, /t[eé]moignages?/i, /\d(?:[,.]\d)?\s*\/\s*5/i],
  tableau: [/^Table:/im, /\|[^\n]+\|/m],
  FAQ: [/FAQ Question:/i, /questions? fr[eé]quentes?/i, /^H[23]:[^\n]*\?$/im],
  galerie: [/galerie/i, /portfolio/i, /(?:photos?|images?) de la galerie/i],
  video: [/vid[eé]o/i, /youtube/i, /vimeo/i]
};

export const criticalInformationTypes: SiteContentType[] = [
  'prix',
  'duree',
  'prestation',
  'paiement',
  'acompte',
  'confidentialite',
  'telephone',
  'email',
  'horaires',
  'formulaire'
];

export function analyzeSiteContent(input: {
  organizationId: string;
  siteId: string;
  pages: IntelligenceSourcePage[];
  generatedAt?: Date;
}): SiteIntelligenceReport {
  const pages = input.pages.map(analyzePage);
  const chunks = input.pages.flatMap((page) =>
    page.chunks.map((chunk) => analyzeChunk(page, chunk))
  );
  const pageTypes = aggregatePages(pages);
  const contentTypes = aggregateContent(chunks);
  const detected = new Set(contentTypes.map((entry) => entry.category));
  const criticalInformationDetected = criticalInformationTypes.filter((type) => detected.has(type));
  const criticalInformationMissing = criticalInformationTypes.filter((type) => !detected.has(type));
  const categoryConfidence = Object.fromEntries(
    [...sitePageTypes, ...siteContentTypes].map((category) => [category, 0])
  ) as SiteIntelligenceReport['categoryConfidence'];
  for (const entry of [...pageTypes, ...contentTypes]) categoryConfidence[entry.category] = entry.confidence;

  return {
    organizationId: input.organizationId,
    siteId: input.siteId,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    pageCount: pages.length,
    chunkCount: chunks.length,
    pages,
    chunks,
    pageTypes,
    contentTypes,
    knowledgeCoverage: {
      detectedCategories: detected.size,
      expectedCategories: siteContentTypes.length,
      percentage: Math.round((detected.size / siteContentTypes.length) * 100)
    },
    criticalInformationDetected,
    criticalInformationMissing,
    categoryConfidence
  };
}

function analyzePage(page: IntelligenceSourcePage): SiteIntelligencePage {
  const pathname = safePathname(page.source);
  const text = `${page.title}\n${page.chunks.map((chunk) => chunk.content).join('\n')}`;
  if (pathname === '/' || pathname === '') {
    return pageResult(page, 'accueil', 0.98, ['URL racine du site']);
  }
  const scores = pageSignals.map((signal) => {
    const evidence = signal.patterns
      .filter((pattern) => pattern.test(`${pathname}\n${text}`))
      .map((pattern) => pattern.source);
    const urlMatches = signal.patterns.filter((pattern) => pattern.test(pathname)).length;
    return {
      type: signal.type,
      score: evidence.length + urlMatches * (signal.urlWeight ?? 2),
      evidence
    };
  }).sort((a, b) => b.score - a.score);
  const winner = scores[0];
  if (!winner || winner.score === 0) return pageResult(page, 'autre', 0.5, []);
  const runnerUp = scores[1]?.score ?? 0;
  const confidence = clamp(0.55 + winner.score * 0.05 + (winner.score - runnerUp) * 0.03);
  return pageResult(page, winner.type, confidence, winner.evidence.slice(0, 5));
}

function analyzeChunk(
  page: IntelligenceSourcePage,
  chunk: IntelligenceSourcePage['chunks'][number]
): SiteIntelligenceChunk {
  const detections = siteContentTypes.flatMap((category) => {
    const evidence = contentSignals[category]
      .flatMap((pattern) => chunk.content.match(pattern)?.[0] ?? [])
      .slice(0, 3);
    if (evidence.length === 0) return [];
    return [{ category, confidence: clamp(0.62 + evidence.length * 0.12), evidence } satisfies IntelligenceDetection<SiteContentType>];
  });
  return {
    chunkId: chunk.chunkId,
    documentId: page.documentId,
    page: page.source,
    position: chunk.position,
    excerpt: chunk.content.slice(0, 500),
    detections
  };
}

function pageResult(
  page: IntelligenceSourcePage,
  type: SitePageType,
  confidence: number,
  evidence: string[]
): SiteIntelligencePage {
  return {
    documentId: page.documentId,
    title: page.title,
    page: page.source,
    type,
    confidence,
    evidence,
    chunkCount: page.chunks.length
  };
}

function aggregatePages(pages: SiteIntelligencePage[]): SiteIntelligenceReport['pageTypes'] {
  return [...new Set(pages.map((page) => page.type))].map((category) => {
    const matching = pages.filter((page) => page.type === category);
    return {
      category,
      count: matching.length,
      confidence: average(matching.map((page) => page.confidence))
    };
  });
}

function aggregateContent(chunks: SiteIntelligenceChunk[]): SiteIntelligenceReport['contentTypes'] {
  return siteContentTypes.flatMap((category) => {
    const matching = chunks.flatMap((chunk) => chunk.detections.filter((item) => item.category === category));
    if (matching.length === 0) return [];
    return [{ category, count: matching.length, confidence: average(matching.map((item) => item.confidence)) }];
  });
}

function safePathname(source: string): string {
  try {
    return new URL(source).pathname.replace(/\/$/, '') || '/';
  } catch {
    return source;
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function clamp(value: number): number {
  return Number(Math.min(0.99, Math.max(0, value)).toFixed(3));
}
