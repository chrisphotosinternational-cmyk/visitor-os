export const knowledgeDocumentTypes = [
  'markdown',
  'txt',
  'html',
  'pdf',
  'docx',
  'csv',
  'json',
  'faq',
  'knowledge_base'
] as const;

export type KnowledgeDocumentType = (typeof knowledgeDocumentTypes)[number];

export const knowledgeStatuses = ['active', 'archived', 'deleted', 'draft'] as const;

export type KnowledgeStatus = (typeof knowledgeStatuses)[number];

export type KnowledgeDocument = {
  id: string;
  organization_id: string;
  site_id: string | null;
  title: string;
  description: string | null;
  category: string;
  type: KnowledgeDocumentType;
  language: string;
  version: number;
  size_bytes: number;
  hash: string;
  status: KnowledgeStatus;
  tags: string[];
  author: string | null;
  source: string;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
};

export type KnowledgeVersion = {
  id: string;
  document_id: string;
  organization_id: string;
  version: number;
  title: string;
  content: string;
  hash: string;
  created_at: Date;
  author: string | null;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  organizationId: string;
  siteId?: string;
  content: string;
  position: number;
  tokens: string[];
  metadata: Record<string, string | number | boolean>;
};

export type KnowledgeSearchResult = {
  documentId: string;
  title: string;
  content: string;
  category: string;
  language: string;
  score: number;
  relevance: 'high' | 'medium' | 'low';
  source: string;
};

export type KnowledgeImportInput = {
  organizationId: string;
  siteId?: string;
  title: string;
  description?: string;
  category: string;
  type: KnowledgeDocumentType;
  language?: string;
  content: string;
  tags?: string[];
  author?: string;
  source?: string;
};

export type KnowledgeSearchInput = {
  organizationId: string;
  siteId?: string;
  query: string;
  language?: string;
  limit?: number;
};

export type KnowledgeStatistics = {
  documents: number;
  totalSizeBytes: number;
  categories: Array<{ category: string; count: number }>;
  searches: number;
  consultedDocuments: number;
  neverUsedDocuments: number;
};
