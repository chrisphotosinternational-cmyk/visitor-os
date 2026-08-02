export const sitePageTypes = [
  'accueil',
  'prestation',
  'tarifs',
  'FAQ',
  'article',
  'guide',
  'contact',
  'portfolio',
  'mentions_legales',
  'CGV',
  'reservation',
  'autre'
] as const;

export type SitePageType = (typeof sitePageTypes)[number];

export const siteContentTypes = [
  'prix',
  'duree',
  'prestation',
  'retouches',
  'nombre_photos',
  'paiement',
  'acompte',
  'deplacement',
  'confidentialite',
  'studio',
  'telephone',
  'email',
  'horaires',
  'formulaire',
  'CTA',
  'avis_client',
  'tableau',
  'FAQ',
  'galerie',
  'video'
] as const;

export type SiteContentType = (typeof siteContentTypes)[number];

export type IntelligenceDetection<T extends string> = {
  category: T;
  confidence: number;
  evidence: string[];
};

export type SiteIntelligencePage = {
  documentId: string;
  title: string;
  page: string;
  type: SitePageType;
  confidence: number;
  evidence: string[];
  chunkCount: number;
};

export type SiteIntelligenceChunk = {
  chunkId: string;
  documentId: string;
  page: string;
  position: number;
  excerpt: string;
  detections: Array<IntelligenceDetection<SiteContentType>>;
};

export type SiteIntelligenceReport = {
  organizationId: string;
  siteId: string;
  generatedAt: string;
  pageCount: number;
  chunkCount: number;
  pages: SiteIntelligencePage[];
  chunks: SiteIntelligenceChunk[];
  pageTypes: Array<{ category: SitePageType; count: number; confidence: number }>;
  contentTypes: Array<{ category: SiteContentType; count: number; confidence: number }>;
  knowledgeCoverage: {
    detectedCategories: number;
    expectedCategories: number;
    percentage: number;
  };
  criticalInformationDetected: SiteContentType[];
  criticalInformationMissing: SiteContentType[];
  categoryConfidence: Record<SitePageType | SiteContentType, number>;
};
