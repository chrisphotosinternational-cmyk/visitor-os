import type { KnowledgeChunk } from './knowledge-types.js';

export type EmbeddingVector = number[];

export type EmbeddingInput = {
  organizationId: string;
  siteId?: string;
  documentId: string;
  chunkId: string;
  text: string;
  language?: string;
  metadata: Record<string, string | number | boolean>;
};

export interface EmbeddingProvider {
  embed(input: EmbeddingInput): Promise<EmbeddingVector>;
  embedBatch?(input: EmbeddingInput[]): Promise<EmbeddingVector[]>;
}

export interface VectorProvider {
  upsert(input: Array<{ chunk: KnowledgeChunk; vector: EmbeddingVector }>): Promise<void>;
  deleteByDocument(documentId: string, organizationId: string): Promise<void>;
  search(input: {
    organizationId: string;
    siteId?: string;
    vector: EmbeddingVector;
    limit: number;
  }): Promise<KnowledgeChunk[]>;
}

export interface Retriever {
  retrieve(input: {
    organizationId: string;
    siteId?: string;
    question: string;
    limit: number;
  }): Promise<KnowledgeChunk[]>;
}

export interface ContextBuilder {
  buildContext(input: {
    question: string;
    chunks: KnowledgeChunk[];
    maxCharacters: number;
  }): string;
}
